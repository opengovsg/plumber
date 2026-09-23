-- Grafana: Pie chart. Query format Table.
-- Label field = slice. Value field = pipes. Show = All values.
-- Time picker filters by execution time (flowed in the window).
-- Pipes are then tagged by when they were created, and by AI Builder.
-- Templates sit in not ai builder.
--
-- PERFORMANCE: EXISTS rides (flow_id, test_run, created_at) and stops at the
-- first in-window live execution per pipe. Do not join executions instead.
WITH bounds AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
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
  pipe_cohort || ', ' || builder AS slice,
  COUNT(*) AS pipes
FROM flowed_pipes
GROUP BY pipe_cohort, builder
ORDER BY pipe_cohort, builder;
