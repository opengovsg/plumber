-- Grafana: query format Table. Stat / table panel.
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
--  * check_steps is the one MATERIALIZED CTE, because it is read twice. Its
--    own parallel scan still runs; only reading a CTE is parallel restricted.
--  * the first success per step comes from MIN ... GROUP BY, not a window
--    function. The window form sorts every attempt row and spills to disk.
--  * the join to steps prunes attempts on steps that never reached completed.
--    Those are excluded from the average anyway.
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
configured_steps AS (
  SELECT p.cohort, s.id AS step_id
  FROM pipes p
  JOIN steps s
    ON s.flow_id = p.id
   AND (s.deleted_at IS NULL OR p.deleted_at IS NOT NULL)
  WHERE s.status = 'completed'
),
test_executions AS (
  SELECT e.id AS execution_id
  FROM pipes p
  JOIN executions e
    ON e.flow_id = p.id
   AND e.test_run = true
),
check_steps AS MATERIALIZED (
  SELECT cst.cohort, es.step_id, es.status, es.created_at
  FROM execution_steps es
  JOIN test_executions te
    ON te.execution_id
     = COALESCE(es.execution_id, '00000000-0000-0000-0000-000000000000'::uuid)
  JOIN configured_steps cst ON cst.step_id = es.step_id
  WHERE NOT (es.metadata ? 'iteration')
     OR COALESCE(es.metadata ->> 'iteration', '') = ''
),
first_success AS (
  SELECT cs.step_id, MIN(cs.created_at) AS first_success_at
  FROM check_steps cs
  WHERE cs.status = 'success'
  GROUP BY cs.step_id
),
attempts_per_step AS (
  SELECT cs.cohort, cs.step_id, COUNT(*) AS attempt_count
  FROM check_steps cs
  JOIN first_success fs ON fs.step_id = cs.step_id
  WHERE cs.created_at <= fs.first_success_at
  GROUP BY cs.cohort, cs.step_id
)
SELECT
  cohort,
  COUNT(*) AS "configured steps",
  ROUND(AVG(attempt_count)::numeric, 2) AS "avg check attempts until success"
FROM attempts_per_step
GROUP BY cohort
ORDER BY cohort;
