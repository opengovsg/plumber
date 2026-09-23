-- Grafana: query format Table. Bar chart, X-axis = pipe cohort.
-- Window is the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Pipes that flowed in the window, tagged by when they were created and by
-- AI Builder. Templates sit in not ai builder.
--
-- PERFORMANCE: EXISTS rides (flow_id, test_run, created_at) and stops at the
-- first in-window live execution per pipe. Do not join executions instead.
WITH bounds AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
      - interval '3 months'
    ) AT TIME ZONE 'Asia/Singapore' AS period_start,
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS period_end
),
flowed_pipes AS (
  SELECT
    CASE
      WHEN f.created_at >= b.period_start THEN 'Created this quarter'
      ELSE 'Created before this quarter'
    END AS pipe_cohort,
    CASE
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig' THEN 'ai builder'
      ELSE 'not ai builder'
    END AS builder
  FROM flows f
  CROSS JOIN bounds b
  WHERE EXISTS (
    SELECT 1
    FROM executions e
    WHERE e.flow_id = f.id
      AND e.test_run = false
      AND e.created_at >= b.period_start
      AND e.created_at < b.period_end
  )
)
SELECT
  pipe_cohort AS "pipe cohort",
  builder,
  COUNT(*) AS pipes
FROM flowed_pipes
GROUP BY pipe_cohort, builder
ORDER BY pipe_cohort, builder;
