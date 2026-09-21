-- Grafana: query format Table. Table panel, sort by fail pct.
-- Percent (0-100) on fail pct.
-- Quoted aliases use spaces so Grafana titles wrap.
-- Time picker filters pipes by flows.created_at.
--
-- PERFORMANCE, do not undo any of these:
--  * execution_steps is filtered by execution_id = ANY (ARRAY(...)). The array
--    makes the id set a constant, so the planner uses a Bitmap Index Scan plus a
--    Bitmap Heap Scan and reads the heap in physical page order. A plain JOIN
--    lets it seq-scan the whole table instead, which is what timed out.
--  * every trigger Check step click inserts a NEW test execution, so a pipe
--    accumulates many of them and most are empty shells. One random index probe
--    per shell is what made the per-execution LATERAL slow here. The bitmap scan
--    collapses them all into one ordered pass.
--  * test_executions stays MATERIALIZED so the id set is built exactly once.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS MATERIALIZED (
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
    AND f.created_at <= p.period_end
),
test_executions AS MATERIALIZED (
  SELECT p.cohort, e.id AS execution_id
  FROM pipes p
  CROSS JOIN LATERAL (
    SELECT e.id
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = true
    OFFSET 0
  ) e
),
check_steps AS MATERIALIZED (
  SELECT es.execution_id, es.app_key, es.key, es.status
  FROM execution_steps es
  WHERE es.execution_id = ANY (ARRAY(SELECT execution_id FROM test_executions))
    AND COALESCE(es.metadata ->> 'iteration', '') = ''
)
SELECT
  te.cohort,
  cs.app_key AS "app key",
  cs.key,
  COUNT(*) AS "check attempts",
  COUNT(*) FILTER (WHERE cs.status = 'failure') AS "failed attempts",
  COUNT(*) FILTER (WHERE cs.status = 'success') AS "successful attempts",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cs.status = 'failure') / NULLIF(COUNT(*), 0),
    1
  ) AS "fail pct"
FROM check_steps cs
JOIN test_executions te ON te.execution_id = cs.execution_id
GROUP BY te.cohort, cs.app_key, cs.key
ORDER BY "failed attempts" DESC, "check attempts" DESC;
