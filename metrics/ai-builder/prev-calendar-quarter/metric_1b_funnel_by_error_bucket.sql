-- Grafana: query format Table. Bar chart, X-axis = error bucket, split by cohort.
-- Percent (0-100) on skeleton to filled pct.
-- Quoted aliases use spaces so Grafana titles wrap.
-- Window is always the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Later stages use that cohort's current outcome, including after the quarter.
--
-- PERFORMANCE: execution_steps is reached only through correlated LATERALs keyed
-- on execution_id. A plain JOIN lets the planner seq-scan the whole table, which
-- is what times out. Keep MATERIALIZED and the LATERALs.
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
pipes AS MATERIALIZED (
  SELECT
    f.id,
    f.deleted_at,
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
test_executions AS MATERIALIZED (
  SELECT p.id AS flow_id, e.id AS execution_id
  FROM pipes p
  CROSS JOIN LATERAL (
    SELECT e.id
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = true
    OFFSET 0
  ) e
),
failed_checks AS MATERIALIZED (
  SELECT te.flow_id, SUM(x.n) AS failed_check_attempts
  FROM test_executions te
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM execution_steps es
    WHERE es.execution_id = te.execution_id
      AND es.status = 'failure'
      AND COALESCE(es.metadata ->> 'iteration', '') = ''
  ) x
  GROUP BY te.flow_id
),
step_state AS MATERIALIZED (
  SELECT
    p.id AS flow_id,
    COUNT(*) AS step_count,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS completed_step_count,
    COUNT(*) FILTER (WHERE s.type = 'action') AS action_count
  FROM pipes p
  JOIN steps s
    ON s.flow_id = p.id
   AND (s.deleted_at IS NULL OR p.deleted_at IS NOT NULL)
  GROUP BY p.id
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
    (
      COALESCE(ss.step_count, 0) > 0
      AND ss.completed_step_count = ss.step_count
      AND ss.action_count >= 1
    ) AS is_filled_in
  FROM pipes p
  LEFT JOIN step_state ss ON ss.flow_id = p.id
  LEFT JOIN failed_checks fc ON fc.flow_id = p.id
)
SELECT
  cohort,
  error_bucket AS "error bucket",
  COUNT(*) AS "skeleton created",
  COUNT(*) FILTER (WHERE is_filled_in) AS "all steps filled in",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_filled_in) / NULLIF(COUNT(*), 0),
    1
  ) AS "skeleton to filled pct"
FROM classified
GROUP BY cohort, error_bucket
ORDER BY cohort, error_bucket;
