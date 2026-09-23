-- Grafana: query format Table. Stat panel.
-- Window is the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Same query as the original, only the bounds CTE changed.
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
)
SELECT
  COUNT(*) FILTER (
    WHERE ff.first_flowed_at >= b.period_start
      AND ff.first_flowed_at <  b.period_end
  ) AS "Users who flowed first pipe this quarter",
  COUNT(*) FILTER (
    WHERE ff.first_flowed_at < b.period_start
  ) AS "Users who had pipes that flowed before this quarter"
FROM first_flow ff
CROSS JOIN bounds b;
