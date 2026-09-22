-- Grafana: query format Table. Table panel, sort by fail pct.
-- Percent (0-100) on fail pct.
-- Quoted aliases use spaces so Grafana titles wrap.
-- Window is always the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Later stages use that cohort's current outcome, including after the quarter.
--
-- PERFORMANCE, do not undo any of these:
--  * COALESCE(es.execution_id, <zero uuid>) is deliberately not indexable. It
--    stops the planner picking one random index probe per test execution. A
--    quarter's cohort has hundreds of thousands of them, and each probe costs
--    about four random page reads. One parallel sequential pass over
--    execution_steps touches roughly 8x fewer pages and reads them in physical
--    order. IMPORTANT: this is the right trade only because the window is a
--    whole quarter. The grafana-time-picker twin keeps the indexed join.
--  * every CTE stays inlined (no MATERIALIZED). A CTE scan is parallel
--    restricted, so materializing one here removes the parallel scan.
--  * ORDER BY sits in the outer query, over the grouped rows. Sorting inside
--    the aggregate makes the planner sort every attempt row instead.
--  * the iteration test leads with the jsonb key check. That short-circuits
--    before ->> has to build text out of the payload.
WITH params AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
      - interval '3 months'
    ) AT TIME ZONE 'Asia/Singapore' AS period_start,
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS period_end
),
pipes AS (
  SELECT
    f.id,
    CASE
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig' THEN 'ai_builder'
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'templateConfig' THEN 'template'
      ELSE 'manual_editor'
    END AS cohort
  FROM flows f
  CROSS JOIN params p
  WHERE f.created_at >= p.period_start
    AND f.created_at < p.period_end
),
test_executions AS (
  SELECT p.cohort, e.id AS execution_id
  FROM pipes p
  JOIN executions e
    ON e.flow_id = p.id
   AND e.test_run = true
),
by_app_action AS (
  SELECT
    te.cohort,
    es.app_key,
    es.key,
    COUNT(*) AS check_attempts,
    COUNT(*) FILTER (WHERE es.status = 'failure') AS failed_attempts,
    COUNT(*) FILTER (WHERE es.status = 'success') AS successful_attempts
  FROM execution_steps es
  JOIN test_executions te
    ON te.execution_id
     = COALESCE(es.execution_id, '00000000-0000-0000-0000-000000000000'::uuid)
  WHERE NOT (es.metadata ? 'iteration')
     OR COALESCE(es.metadata ->> 'iteration', '') = ''
  GROUP BY te.cohort, es.app_key, es.key
)
SELECT
  cohort,
  app_key AS "app key",
  key,
  check_attempts AS "check attempts",
  failed_attempts AS "failed attempts",
  successful_attempts AS "successful attempts",
  ROUND(100.0 * failed_attempts / NULLIF(check_attempts, 0), 1) AS "fail pct"
FROM by_app_action
ORDER BY failed_attempts DESC, check_attempts DESC;
