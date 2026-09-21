-- Grafana: query format Table. Bar chart, X-axis = error_bucket.
-- Percent (0-100) on flowed_pct.
-- Time picker filters pipes by flows.created_at.
--
-- PERFORMANCE, do not undo any of these:
--  * execution_steps is filtered by execution_id = ANY (ARRAY(...)). The array
--    makes the id set a constant, so the planner uses a Bitmap Index Scan plus a
--    Bitmap Heap Scan and reads the heap in physical page order. A plain JOIN
--    lets it seq-scan the whole table instead, which is what timed out.
--  * classified is MATERIALIZED. ever_flowed is referenced twice by the final
--    aggregate, and without the fence it is re-evaluated once per reference,
--    doubling the per-pipe probes into executions.
--  * the live-execution probe is LEFT JOIN LATERAL ... LIMIT 1, not EXISTS.
--    LIMIT 1 blocks subquery pull-up, so it cannot become a semi-join over the
--    whole executions table, and it stops at the first matching row per pipe.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS MATERIALIZED (
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
    AND f.created_at <= p.period_end
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
failed_check_steps AS MATERIALIZED (
  SELECT es.execution_id
  FROM execution_steps es
  WHERE es.execution_id = ANY (ARRAY(SELECT execution_id FROM test_executions))
    AND es.status = 'failure'
    AND COALESCE(es.metadata ->> 'iteration', '') = ''
),
failed_checks AS MATERIALIZED (
  SELECT te.flow_id, COUNT(*) AS failed_check_attempts
  FROM failed_check_steps fcs
  JOIN test_executions te ON te.execution_id = fcs.execution_id
  GROUP BY te.flow_id
),
classified AS MATERIALIZED (
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
  error_bucket,
  COUNT(*) AS pipe_count,
  COUNT(*) FILTER (WHERE ever_flowed) AS flowed_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ever_flowed) / NULLIF(COUNT(*), 0),
    1
  ) AS flowed_pct
FROM classified
GROUP BY cohort, error_bucket
ORDER BY cohort, error_bucket;
