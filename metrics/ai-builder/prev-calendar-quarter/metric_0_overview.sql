-- Grafana: query format Table. Two rows: previous quarter, then current QTD.
-- Quoted aliases use spaces so Stat titles wrap.
-- Calendar quarters in SGT. Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Grafana's time picker is ignored. Current row is quarter-to-date.
--
-- Birth cohort: every pipe with flows.created_at in that row's window.
-- Pipe flowed: a non-test execution, or archived_execution_count > 0.
-- First ever flow: the owner's earliest non-test execution, all pipes, all
-- time, sits in that row's window. Same rule as metric 4.
--
-- PERFORMANCE:
--  * LATERAL ... LIMIT 1 stops at the first live execution per cohort pipe.
--  * classified is MATERIALIZED because the outer SELECT reads it many times.
--  * first_flow runs only for owners of a flowed AI Builder pipe in either
--    window. MIN(...) GROUP BY replaces DISTINCT ON.
WITH sgt AS (
  SELECT date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AS curr_quarter_naive
),
params AS (
  SELECT
    (curr_quarter_naive - interval '3 months') AT TIME ZONE 'Asia/Singapore' AS prev_q_start,
    curr_quarter_naive AT TIME ZONE 'Asia/Singapore' AS current_q_start,
    now() AS current_qtd_end,
    curr_quarter_naive - interval '3 months' AS prev_q_label,
    curr_quarter_naive AS current_q_label
  FROM sgt
),
quarters AS (
  SELECT
    false AS is_qtd,
    1 AS sort_order,
    p.prev_q_start AS period_start,
    p.current_q_start AS period_end,
    to_char(p.prev_q_label, '"Q"Q YYYY') AS window
  FROM params p
  UNION ALL
  SELECT
    true,
    2,
    p.current_q_start,
    p.current_qtd_end,
    to_char(p.current_q_label, '"Q"Q YYYY')
      || ' to ' || to_char(p.current_qtd_end AT TIME ZONE 'Asia/Singapore', 'DD Mon')
  FROM params p
),
pipes AS (
  SELECT
    f.id,
    f.user_id,
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
    p.id,
    p.user_id,
    p.cohort,
    p.is_qtd,
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
owners_flowed AS (
  SELECT DISTINCT user_id
  FROM classified
  WHERE cohort = 'ai_builder'
    AND ever_flowed
),
first_flow AS (
  SELECT f.user_id, MIN(e.created_at) AS first_flowed_at
  FROM owners_flowed o
  JOIN flows f ON f.user_id = o.user_id
  JOIN executions e
    ON e.flow_id = f.id
   AND e.test_run = false
  GROUP BY f.user_id
)
SELECT
  q.window AS "window",
  COUNT(*) FILTER (WHERE c.cohort = 'ai_builder')
    AS "ai builder pipes created",
  COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
    AS "ai builder pipes flowed",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.cohort = 'ai_builder'), 0),
    1
  ) AS "ai builder pipes flowed pct",
  COUNT(DISTINCT c.user_id) FILTER (WHERE c.cohort = 'ai_builder')
    AS "users who created ai builder pipes",
  COUNT(DISTINCT c.user_id) FILTER (
    WHERE c.cohort = 'ai_builder' AND c.ever_flowed
  ) AS "users who created ai builder pipes that flowed",
  COUNT(DISTINCT c.user_id) FILTER (
    WHERE c.cohort = 'ai_builder'
      AND c.ever_flowed
      AND ff.first_flowed_at >= q.period_start
      AND ff.first_flowed_at < q.period_end
  ) AS "ai builder users with first ever flow",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder')
      / NULLIF(COUNT(c.id), 0),
    1
  ) AS "ai builder share of new pipes",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.ever_flowed), 0),
    1
  ) AS "ai builder share of flowed pipes",
  COUNT(*) FILTER (WHERE c.cohort = 'manual_editor')
    AS "manual editor pipes created",
  COUNT(*) FILTER (WHERE c.cohort = 'manual_editor' AND c.ever_flowed)
    AS "manual editor pipes flowed",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'manual_editor' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.cohort = 'manual_editor'), 0),
    1
  ) AS "manual editor pipes flowed pct"
FROM quarters q
LEFT JOIN classified c ON c.is_qtd = q.is_qtd
LEFT JOIN first_flow ff ON ff.user_id = c.user_id
GROUP BY q.window, q.sort_order, q.period_start, q.period_end
ORDER BY q.sort_order;
