-- Grafana: query format Table. Stat panel.
-- Window is the current calendar quarter to date in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [quarter start, now). Grafana's time picker is ignored.
-- First-timers are split by whether the pipe that produced that first-ever
-- flow has aiBuilderConfig. The combined first-timer count is omitted.
WITH bounds AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS period_start,
    now() AS period_end
),
-- users who flowed (non-test) at least once within the quarter
flowed_this_quarter AS (
  SELECT DISTINCT f.user_id
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  CROSS JOIN bounds b
  WHERE e.test_run = false
    AND e.created_at >= b.period_start
    AND e.created_at <  b.period_end
),
-- their first-ever non-test execution, across ALL their pipes, all time
first_flow AS (
  SELECT f.user_id, MIN(e.created_at) AS first_flowed_at
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  WHERE e.test_run = false
    AND f.user_id IN (SELECT user_id FROM flowed_this_quarter)
  GROUP BY f.user_id
),
-- Attribute only first-timers. The LATERAL stops at the earliest live
-- execution per pipe, then picks that owner's earliest pipe. Running it for
-- returners would probe every flowed user for a flag this panel does not use.
attributed AS (
  SELECT
    ff.user_id,
    fp.is_ai_builder
  FROM first_flow ff
  CROSS JOIN bounds b
  CROSS JOIN LATERAL (
    SELECT (COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig') AS is_ai_builder
    FROM flows f
    CROSS JOIN LATERAL (
      SELECT e.created_at, e.id
      FROM executions e
      WHERE e.flow_id = f.id
        AND e.test_run = false
      ORDER BY e.created_at ASC, e.id ASC
      LIMIT 1
    ) e
    WHERE f.user_id = ff.user_id
    ORDER BY e.created_at ASC, e.id ASC
    LIMIT 1
  ) fp
  WHERE ff.first_flowed_at >= b.period_start
    AND ff.first_flowed_at <  b.period_end
)
SELECT
  COUNT(*) FILTER (
    WHERE a.is_ai_builder
  ) AS "First pipe this quarter with ai builder",
  COUNT(*) FILTER (
    WHERE a.is_ai_builder IS FALSE
  ) AS "First pipe this quarter not ai builder",
  COUNT(*) FILTER (
    WHERE ff.first_flowed_at < b.period_start
  ) AS "Users who had pipes that flowed before this quarter"
FROM first_flow ff
CROSS JOIN bounds b
LEFT JOIN attributed a ON a.user_id = ff.user_id;
