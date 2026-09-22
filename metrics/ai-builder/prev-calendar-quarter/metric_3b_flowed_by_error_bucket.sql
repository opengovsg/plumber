-- Grafana: query format Table. Bar chart, X-axis = error bucket.
-- Percent (0-100) on flowed pct.
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
--  * the live-execution probe is LEFT JOIN LATERAL ... LIMIT 1, not EXISTS.
--    LIMIT 1 blocks subquery pull-up, so it cannot become a semi-join over the
--    whole executions table, and it stops at the first matching row per pipe.
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
    f.archived_execution_count,
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
  SELECT p.id AS flow_id, e.id AS execution_id
  FROM pipes p
  JOIN executions e
    ON e.flow_id = p.id
   AND e.test_run = true
),
failed_checks AS (
  SELECT te.flow_id, COUNT(*) AS failed_check_attempts
  FROM execution_steps es
  JOIN test_executions te
    ON te.execution_id
     = COALESCE(es.execution_id, '00000000-0000-0000-0000-000000000000'::uuid)
  WHERE es.status = 'failure'
    AND (
      NOT (es.metadata ? 'iteration')
      OR COALESCE(es.metadata ->> 'iteration', '') = ''
    )
  GROUP BY te.flow_id
),
classified AS (
  SELECT
    p.cohort,
    CASE
      WHEN COALESCE(fc.failed_check_attempts, 0) = 0 THEN '0 errors'
      WHEN COALESCE(fc.failed_check_attempts, 0) BETWEEN 1 AND 3 THEN '1-3 errors'
      WHEN COALESCE(fc.failed_check_attempts, 0) BETWEEN 4 AND 9 THEN '4-9 errors'
      ELSE '10+ errors'
    END AS error_bucket,
    (p.archived_execution_count > 0 OR lv.has_live IS NOT NULL) AS ever_flowed
  FROM pipes p
  LEFT JOIN failed_checks fc ON fc.flow_id = p.id
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
)
SELECT
  cohort,
  error_bucket AS "error bucket",
  COUNT(*) AS "pipe count",
  COUNT(*) FILTER (WHERE ever_flowed) AS "flowed count",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ever_flowed) / NULLIF(COUNT(*), 0),
    1
  ) AS "flowed pct"
FROM classified
GROUP BY cohort, error_bucket
ORDER BY cohort, error_bucket;
