-- Grafana: query format Table. Stat panel (one row, many fields).
-- Window is the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
--
-- Splits the users who flowed in the quarter into first-timers and returners.
-- A user is the owner of the pipe (flows.user_id), not a collaborator.
--
-- IMPORTANT: execution archival deletes executions older than
-- ARCHIVE_RETENTION_DAYS out of Postgres, so the all-time first flow can only be
-- read from surviving rows. A long-time user whose early executions were archived
-- away therefore lands in the first-timer bucket. The last column counts those
-- suspects: any of their pipes carrying archived_execution_count > 0 proves
-- activity older than the retention cutoff. Treat it as the error bar.
--
-- PERFORMANCE:
--  * executions has no index on created_at alone, so the window cannot be
--    pruned. The plan is one parallel sequential pass plus a hash aggregate.
--  * that pass is the only one. Deriving both the all-time first flow and the
--    in-window test from the same aggregate halves the page touches against
--    reading executions once per question.
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
-- Every owner's first non-test execution across all their pipes, all time, plus
-- whether any of it landed in the window.
per_user AS (
  SELECT
    f.user_id,
    MIN(e.created_at) AS first_flowed_at,
    bool_or(
      e.created_at >= b.period_start
      AND e.created_at < b.period_end
    ) AS flowed_in_window
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  CROSS JOIN bounds b
  WHERE e.test_run = false
  GROUP BY f.user_id
),
archived_owners AS (
  SELECT f.user_id
  FROM flows f
  WHERE f.archived_execution_count > 0
  GROUP BY f.user_id
)
SELECT
  -- Scalar subquery, not a grouped column, so the panel still returns one row of
  -- zeroes when nobody flowed. A GROUP BY here would return "no data" instead.
  (
    SELECT to_char(period_start AT TIME ZONE 'Asia/Singapore', '"Q"Q YYYY')
    FROM bounds
  ) AS "window",
  COUNT(*) AS "Users who flowed this quarter",
  COUNT(*) FILTER (
    WHERE u.first_flowed_at >= b.period_start
  ) AS "Users who flowed first pipe this quarter",
  COUNT(*) FILTER (
    WHERE u.first_flowed_at < b.period_start
  ) AS "Users who had pipes that flowed before this quarter",
  COUNT(*) FILTER (
    WHERE u.first_flowed_at >= b.period_start
      AND ao.user_id IS NOT NULL
  ) AS "First-time users with archived executions"
FROM per_user u
CROSS JOIN bounds b
LEFT JOIN archived_owners ao ON ao.user_id = u.user_id
WHERE u.flowed_in_window;
