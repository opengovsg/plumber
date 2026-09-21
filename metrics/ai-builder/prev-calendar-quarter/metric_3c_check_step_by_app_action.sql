-- Grafana: query format Table. Table panel, sort by fail_pct.
-- Percent (0-100) on fail_pct.
-- Window is always the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Later stages use that cohort's current outcome, including after the quarter.
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
  cs.app_key,
  cs.key,
  COUNT(*) AS check_attempts,
  COUNT(*) FILTER (WHERE cs.status = 'failure') AS failed_attempts,
  COUNT(*) FILTER (WHERE cs.status = 'success') AS successful_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cs.status = 'failure') / NULLIF(COUNT(*), 0),
    1
  ) AS fail_pct
FROM check_steps cs
JOIN test_executions te ON te.execution_id = cs.execution_id
GROUP BY te.cohort, cs.app_key, cs.key
ORDER BY failed_attempts DESC, check_attempts DESC;
