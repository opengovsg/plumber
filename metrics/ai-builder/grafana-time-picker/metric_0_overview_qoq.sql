-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Percent (0-100) on the qoq pct columns. Those can be negative.
-- Percentage-point change on the qoq pp column, not a ratio.
-- Calendar quarters in SGT. Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Grafana's time picker is ignored. Current window is quarter-to-date, so
-- count QoQ compares a partial quarter to a full previous quarter.
-- Birth cohort is flows.created_at in each window. Flowed uses that cohort's
-- current outcome, including executions after the window.
--
-- PERFORMANCE: the live-execution probe is LEFT JOIN LATERAL ... LIMIT 1, not
-- EXISTS and not a join onto executions. LIMIT 1 blocks subquery pull-up and
-- stops at the first matching row per pipe.
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
    f.archived_execution_count,
    (f.created_at >= prm.current_q_start) AS is_qtd,
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
    p.is_qtd,
    p.cohort,
    (
      p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS ever_flowed
  FROM pipes p
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
),
stats AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE is_qtd AND cohort = 'ai_builder') AS ai_created_qtd,
    COUNT(*) FILTER (WHERE NOT is_qtd AND cohort = 'ai_builder') AS ai_created_prev,
    COUNT(*) FILTER (
      WHERE is_qtd AND cohort = 'ai_builder' AND ever_flowed
    ) AS ai_flowed_qtd,
    COUNT(*) FILTER (
      WHERE NOT is_qtd AND cohort = 'ai_builder' AND ever_flowed
    ) AS ai_flowed_prev,
    COUNT(*) FILTER (WHERE is_qtd AND cohort = 'manual_editor') AS manual_created_qtd,
    COUNT(*) FILTER (WHERE NOT is_qtd AND cohort = 'manual_editor') AS manual_created_prev,
    COUNT(*) FILTER (
      WHERE is_qtd AND cohort = 'manual_editor' AND ever_flowed
    ) AS manual_flowed_qtd,
    COUNT(*) FILTER (
      WHERE NOT is_qtd AND cohort = 'manual_editor' AND ever_flowed
    ) AS manual_flowed_prev,
    COUNT(*) FILTER (WHERE is_qtd) AS all_created_qtd,
    COUNT(*) FILTER (WHERE NOT is_qtd) AS all_created_prev
  FROM classified
)
SELECT
  to_char(
    prm.current_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) || ' to ' || to_char(
    prm.current_qtd_end AT TIME ZONE 'Asia/Singapore',
    'DD Mon'
  ) || ' vs ' || to_char(
    prm.prev_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) AS "window",
  s.ai_created_qtd AS "ai builder created",
  ROUND(
    100.0 * (s.ai_created_qtd - s.ai_created_prev) / NULLIF(s.ai_created_prev, 0),
    1
  ) AS "ai builder created qoq pct",
  s.ai_flowed_qtd AS "ai builder flowed",
  ROUND(
    100.0 * (s.ai_flowed_qtd - s.ai_flowed_prev) / NULLIF(s.ai_flowed_prev, 0),
    1
  ) AS "ai builder flowed qoq pct",
  s.manual_created_qtd AS "manual created",
  ROUND(
    100.0 * (s.manual_created_qtd - s.manual_created_prev)
      / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual created qoq pct",
  s.manual_flowed_qtd AS "manual flowed",
  ROUND(
    100.0 * (s.manual_flowed_qtd - s.manual_flowed_prev)
      / NULLIF(s.manual_flowed_prev, 0),
    1
  ) AS "manual flowed qoq pct",
  s.all_created_qtd AS "total new pipes",
  ROUND(
    100.0 * (s.all_created_qtd - s.all_created_prev) / NULLIF(s.all_created_prev, 0),
    1
  ) AS "total new pipes qoq pct",
  ROUND(
    100.0 * s.ai_created_qtd / NULLIF(s.all_created_qtd, 0),
    1
  ) AS "ai builder share of new pipes",
  ROUND(
    100.0 * s.ai_created_qtd / NULLIF(s.all_created_qtd, 0)
      - 100.0 * s.ai_created_prev / NULLIF(s.all_created_prev, 0),
    1
  ) AS "ai builder share of new pipes qoq pp"
FROM stats s
CROSS JOIN params prm;
