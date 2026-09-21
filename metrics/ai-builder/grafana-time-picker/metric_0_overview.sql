-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Time picker filters pipes by flows.created_at (birth cohort).
-- Later stages use that cohort's current outcome, including after the range.
--
-- PERFORMANCE: the live-execution probe is LEFT JOIN LATERAL ... LIMIT 1, not
-- EXISTS and not a join onto executions. LIMIT 1 blocks subquery pull-up and
-- stops at the first matching row per pipe. classified is MATERIALIZED because
-- flowed / succeeded are each referenced more than once by the outer SELECT.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS MATERIALIZED (
  SELECT
    f.id,
    f.user_id,
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
classified AS MATERIALIZED (
  SELECT
    p.id,
    p.user_id,
    p.cohort,
    p.active,
    p.deleted_at,
    (
      p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS ever_flowed,
    (sc.has_success IS NOT NULL) AS ever_succeeded,
    (fw.has_live_in_window IS NOT NULL) AS flowed_in_window
  FROM pipes p
  CROSS JOIN params prm
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
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live_in_window
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
      AND e.created_at >= prm.period_start
      AND e.created_at <= prm.period_end
    LIMIT 1
  ) fw ON true
)
SELECT
  COUNT(*) FILTER (WHERE cohort = 'ai_builder') AS "ai builder created",
  COUNT(*) FILTER (WHERE cohort = 'ai_builder' AND ever_flowed) AS "ai builder flowed",
  COUNT(*) FILTER (
    WHERE cohort = 'ai_builder'
      AND active
      AND deleted_at IS NULL
  ) AS "ai builder currently published",
  COUNT(*) FILTER (WHERE cohort = 'ai_builder' AND ever_succeeded) AS "ai builder succeeded",
  COUNT(*) FILTER (WHERE cohort = 'ai_builder' AND flowed_in_window) AS "ai builder flowed in window",
  COUNT(DISTINCT user_id) FILTER (WHERE cohort = 'ai_builder') AS "ai builder owners",
  COUNT(DISTINCT user_id) FILTER (
    WHERE cohort = 'ai_builder' AND ever_flowed
  ) AS "ai builder owners with a flowed pipe",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cohort = 'ai_builder' AND ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE cohort = 'ai_builder'), 0),
    1
  ) AS "ai builder flowed pct",
  COUNT(*) FILTER (WHERE cohort = 'manual_editor') AS "manual editor created",
  COUNT(*) FILTER (WHERE cohort = 'manual_editor' AND ever_flowed) AS "manual editor flowed",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cohort = 'manual_editor' AND ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE cohort = 'manual_editor'), 0),
    1
  ) AS "manual editor flowed pct",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cohort = 'ai_builder')
      / NULLIF(COUNT(*), 0),
    1
  ) AS "ai builder share of new pipes",
  (
    SELECT COUNT(*)
    FROM flows f
    WHERE f.deleted_at IS NULL
      AND f.active
      AND COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig'
  ) AS "ai builder published snapshot"
FROM classified;
