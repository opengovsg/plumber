-- Grafana: query format Table. Stat / table panel.
-- Time picker filters pipes by flows.created_at.
--
-- PERFORMANCE: execution_steps is reached only through correlated LATERALs keyed
-- on execution_id. OFFSET 0 stops the planner from flattening the LATERAL into a
-- hash join over the whole table. Keep MATERIALIZED, the LATERALs and OFFSET 0.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
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
),
check_steps AS MATERIALIZED (
  SELECT es.step_id, es.status, es.created_at
  FROM test_executions te
  CROSS JOIN LATERAL (
    SELECT es.step_id, es.status, es.created_at
    FROM execution_steps es
    WHERE es.execution_id = te.execution_id
      AND COALESCE(es.metadata ->> 'iteration', '') = ''
    OFFSET 0
  ) es
),
-- One pass over check_steps: tag every attempt with its step's first success.
attempts_per_step AS (
  SELECT r.step_id, COUNT(*) AS attempt_count
  FROM (
    SELECT
      cs.step_id,
      cs.created_at,
      MIN(cs.created_at) FILTER (WHERE cs.status = 'success')
        OVER (PARTITION BY cs.step_id) AS first_success_at
    FROM check_steps cs
  ) r
  WHERE r.first_success_at IS NOT NULL
    AND r.created_at <= r.first_success_at
  GROUP BY r.step_id
),
configured_steps AS MATERIALIZED (
  SELECT p.cohort, s.id AS step_id
  FROM pipes p
  JOIN steps s
    ON s.flow_id = p.id
   AND (s.deleted_at IS NULL OR p.deleted_at IS NOT NULL)
  WHERE s.status = 'completed'
)
SELECT
  cs.cohort,
  COUNT(*) AS configured_steps,
  ROUND(AVG(a.attempt_count)::numeric, 2) AS avg_check_attempts_until_success
FROM configured_steps cs
JOIN attempts_per_step a ON a.step_id = cs.step_id
GROUP BY cs.cohort
ORDER BY cs.cohort;
