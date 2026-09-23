-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Window is the current calendar quarter to date in SGT, same as metric 4.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [quarter start, now). Grafana's time picker is ignored.
--
-- The window is shorter than a full quarter, so read the counts next to the
-- prev-calendar-quarter twin only with that in mind.
--
-- Birth cohort: every pipe with flows.created_at in the window, including
-- templates and deleted pipes. Manual-editor excludes templateConfig.
-- Pipe flowed: a non-test execution, or archived_execution_count > 0.
-- User flowed: that owner has at least one AI Builder pipe in the cohort
-- that flowed.
-- First ever flow: the owner's earliest non-test execution across all pipes,
-- all time, sits in the window. Same rule as metric 4.
--
-- PERFORMANCE:
--  * LATERAL ... LIMIT 1 stops at the first live execution per cohort pipe.
--  * classified is MATERIALIZED because the outer SELECT reads it many times.
--  * first_flow runs only for owners of a flowed AI Builder pipe, not for
--    every user. MIN(...) GROUP BY replaces DISTINCT ON, so there is no sort
--    of the whole executions table.
WITH bounds AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS period_start,
    now() AS period_end
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
  CROSS JOIN bounds b
  WHERE f.created_at >= b.period_start
    AND f.created_at < b.period_end
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
  (
    SELECT
      to_char(period_start AT TIME ZONE 'Asia/Singapore', '"Q"Q YYYY')
      || ' to ' || to_char(period_end AT TIME ZONE 'Asia/Singapore', 'DD Mon')
    FROM bounds
  ) AS "window",
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
      AND ff.first_flowed_at >= b.period_start
      AND ff.first_flowed_at < b.period_end
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
CROSS JOIN bounds b
LEFT JOIN first_flow ff ON ff.user_id = c.user_id;
