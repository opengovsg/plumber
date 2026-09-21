-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Percent (0-100) on qoq pct columns. Those can be negative.
-- Percent-point change is on the qoq pp columns, not a ratio.
-- Calendar quarters in SGT. Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Grafana's time picker is ignored. Current window is quarter-to-date, so
-- count QoQ compares a partial quarter to a full previous quarter.
-- Birth cohort is flows.created_at in each window. Later stages use that
-- cohort's current outcome, including after the window.
--
-- PERFORMANCE: the live-execution probe is LEFT JOIN LATERAL ... LIMIT 1, not
-- EXISTS and not a join onto executions. LIMIT 1 blocks subquery pull-up and
-- stops at the first matching row per pipe. classified is MATERIALIZED because
-- flowed is referenced more than once by the outer SELECT.
WITH params AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
      - interval '3 months'
    ) AT TIME ZONE 'Asia/Singapore' AS prev_q_start,
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS current_q_start,
    now() AS current_qtd_end
),
pipes AS MATERIALIZED (
  SELECT
    f.id,
    f.user_id,
    f.active,
    f.deleted_at,
    f.archived_execution_count,
    CASE
      WHEN f.created_at >= prm.current_q_start THEN 'current qtd'
      ELSE 'previous quarter'
    END AS period,
    CASE
      WHEN f.created_at >= prm.current_q_start THEN prm.current_q_start
      ELSE prm.prev_q_start
    END AS period_start,
    CASE
      WHEN f.created_at >= prm.current_q_start THEN prm.current_qtd_end
      ELSE prm.current_q_start
    END AS period_end,
    CASE
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig' THEN 'ai_builder'
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'templateConfig' THEN 'template'
      ELSE 'manual_editor'
    END AS cohort
  FROM flows f
  CROSS JOIN params prm
  WHERE f.created_at >= prm.prev_q_start
    AND f.created_at < prm.current_qtd_end
),
classified AS MATERIALIZED (
  SELECT
    p.period,
    p.user_id,
    p.cohort,
    p.active,
    p.deleted_at,
    (
      p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS ever_flowed,
    (fw.has_live_in_window IS NOT NULL) AS flowed_in_window
  FROM pipes p
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live_in_window
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
      AND e.created_at >= p.period_start
      AND e.created_at < p.period_end
    LIMIT 1
  ) fw ON true
),
stats AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (
      WHERE period = 'current qtd' AND cohort = 'ai_builder'
    ) AS created_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'ai_builder'
    ) AS created_prev,
    COUNT(*) FILTER (
      WHERE period = 'current qtd' AND cohort = 'ai_builder' AND ever_flowed
    ) AS flowed_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'ai_builder' AND ever_flowed
    ) AS flowed_prev,
    COUNT(*) FILTER (
      WHERE period = 'current qtd'
        AND cohort = 'ai_builder'
        AND active
        AND deleted_at IS NULL
    ) AS published_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter'
        AND cohort = 'ai_builder'
        AND active
        AND deleted_at IS NULL
    ) AS published_prev,
    COUNT(*) FILTER (
      WHERE period = 'current qtd' AND cohort = 'ai_builder' AND flowed_in_window
    ) AS flowed_in_window_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'ai_builder' AND flowed_in_window
    ) AS flowed_in_window_prev,
    COUNT(DISTINCT user_id) FILTER (
      WHERE period = 'current qtd' AND cohort = 'ai_builder' AND ever_flowed
    ) AS owners_flowed_qtd,
    COUNT(DISTINCT user_id) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'ai_builder' AND ever_flowed
    ) AS owners_flowed_prev,
    COUNT(*) FILTER (
      WHERE period = 'current qtd' AND cohort = 'manual_editor'
    ) AS manual_created_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'manual_editor'
    ) AS manual_created_prev,
    COUNT(*) FILTER (
      WHERE period = 'current qtd' AND cohort = 'manual_editor' AND ever_flowed
    ) AS manual_flowed_qtd,
    COUNT(*) FILTER (
      WHERE period = 'previous quarter' AND cohort = 'manual_editor' AND ever_flowed
    ) AS manual_flowed_prev,
    COUNT(*) FILTER (WHERE period = 'current qtd') AS pipes_qtd,
    COUNT(*) FILTER (WHERE period = 'previous quarter') AS pipes_prev
  FROM classified
)
SELECT
  to_char(
    prm.current_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) || ' to ' || to_char(
    prm.current_qtd_end AT TIME ZONE 'Asia/Singapore',
    'DD Mon'
  ) AS "current qtd window",
  to_char(
    prm.prev_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) AS "previous quarter window",
  s.created_qtd AS "ai builder created qtd",
  s.created_prev AS "ai builder created prev q",
  ROUND(
    100.0 * (s.created_qtd - s.created_prev) / NULLIF(s.created_prev, 0),
    1
  ) AS "ai builder created qoq pct",
  s.flowed_qtd AS "ai builder flowed qtd",
  s.flowed_prev AS "ai builder flowed prev q",
  ROUND(
    100.0 * (s.flowed_qtd - s.flowed_prev) / NULLIF(s.flowed_prev, 0),
    1
  ) AS "ai builder flowed qoq pct",
  s.published_qtd AS "ai builder currently published qtd",
  s.published_prev AS "ai builder currently published prev q",
  ROUND(
    100.0 * (s.published_qtd - s.published_prev) / NULLIF(s.published_prev, 0),
    1
  ) AS "ai builder currently published qoq pct",
  s.flowed_in_window_qtd AS "ai builder flowed in window qtd",
  s.flowed_in_window_prev AS "ai builder flowed in window prev q",
  ROUND(
    100.0 * (s.flowed_in_window_qtd - s.flowed_in_window_prev)
      / NULLIF(s.flowed_in_window_prev, 0),
    1
  ) AS "ai builder flowed in window qoq pct",
  s.owners_flowed_qtd AS "ai builder owners with a flowed pipe qtd",
  s.owners_flowed_prev AS "ai builder owners with a flowed pipe prev q",
  ROUND(
    100.0 * (s.owners_flowed_qtd - s.owners_flowed_prev)
      / NULLIF(s.owners_flowed_prev, 0),
    1
  ) AS "ai builder owners with a flowed pipe qoq pct",
  ROUND(
    100.0 * s.flowed_qtd / NULLIF(s.created_qtd, 0),
    1
  ) AS "ai builder flowed pct qtd",
  ROUND(
    100.0 * s.flowed_prev / NULLIF(s.created_prev, 0),
    1
  ) AS "ai builder flowed pct prev q",
  ROUND(
    100.0 * s.flowed_qtd / NULLIF(s.created_qtd, 0)
      - 100.0 * s.flowed_prev / NULLIF(s.created_prev, 0),
    1
  ) AS "ai builder flowed pct qoq pp",
  s.manual_created_qtd AS "manual editor created qtd",
  s.manual_created_prev AS "manual editor created prev q",
  ROUND(
    100.0 * (s.manual_created_qtd - s.manual_created_prev)
      / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual editor created qoq pct",
  s.manual_flowed_qtd AS "manual editor flowed qtd",
  s.manual_flowed_prev AS "manual editor flowed prev q",
  ROUND(
    100.0 * (s.manual_flowed_qtd - s.manual_flowed_prev)
      / NULLIF(s.manual_flowed_prev, 0),
    1
  ) AS "manual editor flowed qoq pct",
  ROUND(
    100.0 * s.manual_flowed_qtd / NULLIF(s.manual_created_qtd, 0),
    1
  ) AS "manual editor flowed pct qtd",
  ROUND(
    100.0 * s.manual_flowed_prev / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual editor flowed pct prev q",
  ROUND(
    100.0 * s.manual_flowed_qtd / NULLIF(s.manual_created_qtd, 0)
      - 100.0 * s.manual_flowed_prev / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual editor flowed pct qoq pp",
  ROUND(
    100.0 * s.created_qtd / NULLIF(s.pipes_qtd, 0),
    1
  ) AS "ai builder share of new pipes qtd",
  ROUND(
    100.0 * s.created_prev / NULLIF(s.pipes_prev, 0),
    1
  ) AS "ai builder share of new pipes prev q",
  ROUND(
    100.0 * s.created_qtd / NULLIF(s.pipes_qtd, 0)
      - 100.0 * s.created_prev / NULLIF(s.pipes_prev, 0),
    1
  ) AS "ai builder share of new pipes qoq pp"
FROM stats s
CROSS JOIN params prm;
