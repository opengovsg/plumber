-- Grafana: query format Table. Bar chart, X-axis = quarter.
-- Percent (0-100) on ai builder pct.
-- Two rows: previous calendar quarter, and current calendar quarter to date.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec. Grafana's time picker is ignored.
--
-- Newly activated is the same rule as metric_4_newly_activated_users_original.sql:
-- first-ever non-test execution across all pipes, all time, lands in the window.
-- AI Builder is attributed from the pipe that produced that first execution.
-- No deleted_at guard on executions or flows, and no users join, matching metric 4.
WITH sgt AS (
  SELECT date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AS curr_quarter_naive
),
bounds AS (
  -- Interval math on naive SGT first (avoid timestamptz month-shift).
  SELECT
    (curr_quarter_naive - interval '3 months') AT TIME ZONE 'Asia/Singapore' AS prev_quarter_start,
    curr_quarter_naive AT TIME ZONE 'Asia/Singapore' AS curr_quarter_start,
    now() AS curr_quarter_end,
    curr_quarter_naive - interval '3 months' AS prev_quarter_label,
    curr_quarter_naive AS curr_quarter_label
  FROM sgt
),
quarters AS (
  SELECT
    b.prev_quarter_label AS quarter,
    b.prev_quarter_start AS period_start,
    b.curr_quarter_start AS period_end
  FROM bounds b
  UNION ALL
  SELECT
    b.curr_quarter_label,
    b.curr_quarter_start,
    b.curr_quarter_end
  FROM bounds b
),
-- Same grain as metric 4's first_flow: one row per owner, the earliest surviving
-- non-test execution across every pipe they own. e.id breaks timestamp ties so
-- the AI Builder flag is taken from a single pipe.
first_flow AS (
  SELECT DISTINCT ON (f.user_id)
    f.user_id,
    e.created_at AS first_flowed_at,
    (COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig') AS is_ai_builder
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  WHERE e.test_run = false
  ORDER BY f.user_id, e.created_at ASC, e.id ASC
),
newly_activated AS (
  SELECT
    ff.user_id,
    ff.is_ai_builder,
    CASE
      WHEN ff.first_flowed_at < b.curr_quarter_start THEN b.prev_quarter_label
      ELSE b.curr_quarter_label
    END AS quarter
  FROM first_flow ff
  CROSS JOIN bounds b
  WHERE ff.first_flowed_at >= b.prev_quarter_start
    AND ff.first_flowed_at < b.curr_quarter_end
)
SELECT
  to_char(q.quarter, '"Q"Q YYYY') AS quarter,
  COUNT(na.user_id) AS "newly activated users",
  COUNT(na.user_id) FILTER (WHERE na.is_ai_builder) AS "ai builder attributed",
  ROUND(
    100.0 * COUNT(na.user_id) FILTER (WHERE na.is_ai_builder)
      / NULLIF(COUNT(na.user_id), 0),
    1
  ) AS "ai builder pct"
FROM quarters q
LEFT JOIN newly_activated na ON na.quarter = q.quarter
GROUP BY q.quarter
ORDER BY q.quarter;
