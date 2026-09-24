-- Grafana: query format Table. Bar chart, X-axis = cohort.
-- Percent (0-100) on the pct columns.
-- Quoted aliases use spaces so Grafana titles wrap.
-- Time picker filters pipes by flows.created_at (birth cohort).
-- Later stages use that cohort's current outcome, including after the range.
-- Grain is distinct owners (flows.user_id), not pipes. A user reaches a
-- stage if any of their birth-cohort pipes in that cohort does.
--
-- PERFORMANCE, do not undo either of these:
--  * classified is MATERIALIZED. turned_on and ever_succeeded are each referenced
--    three times by the final aggregate, and without the fence each reference is
--    re-evaluated per pipe, tripling the probes into executions.
--  * the outcome probes are LEFT JOIN LATERAL ... LIMIT 1, not EXISTS. LIMIT 1
--    blocks subquery pull-up, so neither can become a semi-join over the whole
--    executions table, and each stops at the first matching row per pipe.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS MATERIALIZED (
  SELECT
    f.id,
    f.user_id,
    f.created_at,
    f.active,
    f.deleted_at,
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
step_state AS MATERIALIZED (
  SELECT
    p.id AS flow_id,
    COUNT(*) AS step_count,
    COUNT(*) FILTER (
      WHERE s.app_key IS NOT NULL AND s.key IS NOT NULL
    ) AS keyed_step_count,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS completed_step_count,
    COUNT(*) FILTER (WHERE s.type = 'action') AS action_count
  FROM pipes p
  JOIN steps s
    ON s.flow_id = p.id
   AND (s.deleted_at IS NULL OR p.deleted_at IS NOT NULL)
  GROUP BY p.id
),
classified AS MATERIALIZED (
  SELECT
    p.user_id,
    p.cohort,
    (
      COALESCE(ss.step_count, 0) > 0
      AND ss.keyed_step_count = ss.step_count
      AND ss.action_count >= 1
    ) AS all_steps_keyed,
    (
      COALESCE(ss.step_count, 0) > 0
      AND ss.completed_step_count = ss.step_count
      AND ss.action_count >= 1
    ) AS all_steps_filled_in,
    (
      p.active
      OR p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS turned_on,
    (sc.has_success IS NOT NULL) AS ever_succeeded
  FROM pipes p
  LEFT JOIN step_state ss ON ss.flow_id = p.id
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
  LEFT JOIN LATERAL (
    SELECT 1 AS has_success
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
      AND e.status = 'success'
    LIMIT 1
  ) sc ON true
)
SELECT
  cohort,
  COUNT(DISTINCT user_id) AS "skeleton created",
  COUNT(DISTINCT user_id) FILTER (WHERE all_steps_keyed) AS "all steps keyed",
  COUNT(DISTINCT user_id) FILTER (WHERE all_steps_filled_in) AS "all steps filled in",
  COUNT(DISTINCT user_id) FILTER (WHERE turned_on) AS "turned on",
  COUNT(DISTINCT user_id) FILTER (WHERE ever_succeeded) AS "ran successfully",
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE all_steps_filled_in)
      / NULLIF(COUNT(DISTINCT user_id), 0),
    1
  ) AS "skeleton to filled pct",
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE turned_on)
      / NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE all_steps_filled_in), 0),
    1
  ) AS "filled to turned on pct",
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE ever_succeeded)
      / NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE turned_on), 0),
    1
  ) AS "turned on to success pct",
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE ever_succeeded)
      / NULLIF(COUNT(DISTINCT user_id), 0),
    1
  ) AS "skeleton to success pct"
FROM classified
GROUP BY cohort
ORDER BY cohort;
