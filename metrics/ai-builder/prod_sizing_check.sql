-- Sizing check for the Check step panels (1b, 3a, 3b, 3c).
-- Run this on the prod read-replica with the SAME window as the Grafana panel.
-- It reports the three cardinalities that drive panel runtime, and is far
-- cheaper than the panels themselves.
--
-- Substitute the two literals for the range you want to test, e.g.
--   timestamp '2026-01-01 00:00:00' AT TIME ZONE 'Asia/Singapore'
WITH params AS (
  SELECT
    '-infinity'::timestamptz AS period_start,
    'infinity'::timestamptz AS period_end
),
pipes AS MATERIALIZED (
  SELECT f.id
  FROM flows f
  CROSS JOIN params p
  WHERE f.created_at >= p.period_start
    AND f.created_at <= p.period_end
),
test_executions AS MATERIALIZED (
  SELECT e.id AS execution_id
  FROM pipes p
  CROSS JOIN LATERAL (
    SELECT e.id
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = true
    OFFSET 0
  ) e
)
SELECT
  (SELECT COUNT(*) FROM pipes) AS pipes_in_range,
  (SELECT COUNT(*) FROM test_executions) AS test_executions,
  (
    SELECT COUNT(*)
    FROM execution_steps es
    WHERE es.execution_id = ANY (ARRAY(SELECT execution_id FROM test_executions))
  ) AS check_step_rows,
  (SELECT COUNT(*) FROM execution_steps) AS execution_steps_total;
