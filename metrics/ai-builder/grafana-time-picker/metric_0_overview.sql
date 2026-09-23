-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Time picker filters pipes by flows.created_at (birth cohort).
-- Later stages use that cohort's current outcome, including after the range.
-- Same columns as the calendar-quarter twins. Use those files for metric 4
-- windows.
--
-- PERFORMANCE:
--  * LATERAL ... LIMIT 1 stops at the first live execution per cohort pipe.
--  * classified is MATERIALIZED because the outer SELECT reads it many times.
--  * first_flow runs only for owners of a flowed AI Builder pipe, not for
--    every user. MIN(...) GROUP BY replaces DISTINCT ON, so there is no sort
--    of the whole executions table.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS (
  SELECT
    f.id,
    f.user_id,
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
    (
      p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS ever_flowed
  FROM pipes p
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
),
owners_flowed AS (
  SELECT DISTINCT user_id
  FROM classified
  WHERE cohort = 'ai_builder'
    AND ever_flowed
),
first_flow AS (
  SELECT f.user_id, MIN(e.created_at) AS first_flowed_at
  FROM owners_flowed o
  JOIN flows f ON f.user_id = o.user_id
  JOIN executions e
    ON e.flow_id = f.id
   AND e.test_run = false
  GROUP BY f.user_id
)
SELECT
  COUNT(*) FILTER (WHERE c.cohort = 'ai_builder')
    AS "ai builder pipes created",
  COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
    AS "ai builder pipes flowed",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.cohort = 'ai_builder'), 0),
    1
  ) AS "ai builder pipes flowed pct",
  COUNT(DISTINCT c.user_id) FILTER (WHERE c.cohort = 'ai_builder')
    AS "users who created ai builder pipes",
  COUNT(DISTINCT c.user_id) FILTER (
    WHERE c.cohort = 'ai_builder' AND c.ever_flowed
  ) AS "users who created ai builder pipes that flowed",
  COUNT(DISTINCT c.user_id) FILTER (
    WHERE c.cohort = 'ai_builder'
      AND c.ever_flowed
      AND ff.first_flowed_at >= prm.period_start
      AND ff.first_flowed_at <= prm.period_end
  ) AS "ai builder users with first ever flow",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder')
      / NULLIF(COUNT(*), 0),
    1
  ) AS "ai builder share of new pipes",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'ai_builder' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.ever_flowed), 0),
    1
  ) AS "ai builder share of flowed pipes",
  COUNT(*) FILTER (WHERE c.cohort = 'manual_editor')
    AS "manual editor pipes created",
  COUNT(*) FILTER (WHERE c.cohort = 'manual_editor' AND c.ever_flowed)
    AS "manual editor pipes flowed",
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.cohort = 'manual_editor' AND c.ever_flowed)
      / NULLIF(COUNT(*) FILTER (WHERE c.cohort = 'manual_editor'), 0),
    1
  ) AS "manual editor pipes flowed pct"
FROM classified c
CROSS JOIN params prm
LEFT JOIN first_flow ff ON ff.user_id = c.user_id;
