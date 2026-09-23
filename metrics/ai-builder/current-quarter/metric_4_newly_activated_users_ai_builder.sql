-- Grafana: query format Table. Bar chart, X-axis = quarter.
-- Percent (0-100) on ai builder pct.
-- Two rows: previous calendar quarter, and current calendar quarter to date.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec. Grafana's time picker is ignored.
--
-- Timeframe matches metric_4_newly_activated_users_original.sql:
--   previous quarter = [prev quarter start, current quarter start)
--   current quarter  = [current quarter start, now)
-- Interval math is on naive SGT first, then converted back to timestamptz.
WITH sgt AS (
  SELECT date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AS curr_quarter_naive
),
bounds AS (
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
first_in_window AS (
  SELECT DISTINCT ON (f.user_id)
    f.user_id,
    f.id AS flow_id,
    e.created_at AS activated_at,
    (f.config ? 'aiBuilderConfig') AS is_ai_builder
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  CROSS JOIN bounds b
  WHERE e.test_run = false
    AND e.deleted_at IS NULL
    AND e.created_at >= b.prev_quarter_start
    AND e.created_at < b.curr_quarter_end
  ORDER BY f.user_id, e.created_at ASC, e.id ASC
),
newly_activated AS (
  SELECT
    fiw.*,
    CASE
      WHEN fiw.activated_at < b.curr_quarter_start THEN b.prev_quarter_label
      ELSE b.curr_quarter_label
    END AS quarter
  FROM first_in_window fiw
  JOIN users u ON u.id = fiw.user_id AND u.deleted_at IS NULL
  CROSS JOIN bounds b
  WHERE NOT EXISTS (
    SELECT 1
    FROM flows f
    JOIN executions e ON e.flow_id = f.id
      AND e.test_run = false
      AND e.deleted_at IS NULL
      AND e.created_at < b.prev_quarter_start
    WHERE f.user_id = fiw.user_id
  )
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
