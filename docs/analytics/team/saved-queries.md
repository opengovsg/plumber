# Saved queries

Worked queries with every rule from [gotchas.md](gotchas.md) applied. If a new
query for one of these questions differs from its saved query, recheck it
against [glossary.md](glossary.md) and [gotchas.md](gotchas.md).

Production queries run through the TablePlus MCP's `execute_read_query`. It
rejects the `BEGIN`, `SET` and `ROLLBACK` lines, so send only the query
between them. Query 1 shows the memory guard for a connection that accepts it,
e.g. the local dev database through psql.

## 1. Active pipes last quarter that ran a given trigger and action

**Question:** "How many pipes flowed last quarter using the gathersg trigger
and the slack action?"

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15min';
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL hash_mem_multiplier = 1.0;
SET LOCAL jit = off;
SET LOCAL enable_memoize = off;

WITH bounds AS (
  SELECT
    (date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') - interval '3 months') AT TIME ZONE 'Asia/Singapore' AS quarter_start,
    date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore' AS quarter_end
)
SELECT COUNT(*) AS pipe_count
FROM (
  SELECT e.flow_id
  FROM bounds b
  JOIN executions e
    ON e.created_at >= b.quarter_start AND e.created_at < b.quarter_end
  JOIN execution_steps es ON es.execution_id = e.id
  JOIN steps s ON s.id = es.step_id
  WHERE e.test_run = false
    AND es.app_key IN ('gathersg', 'slack')
  GROUP BY e.flow_id
  HAVING bool_or(es.app_key = 'gathersg' AND s.type = 'trigger')
     AND bool_or(es.app_key = 'slack' AND s.type = 'action')
) active_pipes;

ROLLBACK;
```

Notes:

- The app comes from `execution_steps.app_key`, which records what ran.
  `steps.app_key` shows the pipe's current state and misses steps changed since.
- `steps` is joined only for `type`, with no `deleted_at` guard. A step's type
  never changes, so its current row is safe to read.
- To match a specific trigger or action, filter on `es.key`. It exists only
  from 6 Jun 2025. See [sources.md#data-changes](sources.md#data-changes).
- A pipe counts only if both steps ran in the quarter. A slack action that every
  execution skipped, e.g. behind an if-then branch, does not count.
- This is an active-pipe count, so no table has a `deleted_at` guard.

## 2. Agency breakdown of owners of published pipes containing an app

**Question:** "Which agencies do the owners of published pipes with the slack
action come from?"

```sql
SELECT
  split_part(u.email, '@', 2) AS agency,
  COUNT(DISTINCT f.id) AS pipe_count
FROM flows f
JOIN users u ON u.id = f.user_id AND u.deleted_at IS NULL
WHERE f.deleted_at IS NULL
  AND f.active = true
  AND EXISTS (
    SELECT 1 FROM steps s
    WHERE s.flow_id = f.id
      AND s.app_key = 'slack'
      AND s.type = 'action'
      AND s.deleted_at IS NULL
  )
GROUP BY agency
ORDER BY pipe_count DESC;
```

Notes:

- "Published" is `flows.active = true`, not the computed active pipe.
- "Owner" is `flows.user_id`, not a collaborator.

## 3. Quarterly active-user retention for the 3 quarters up to a target quarter

**Question:** "What is the 1-, 2-, 3- and 4-quarter retention of active users
for the last 3 quarters?" Set `target_quarter` to the SGT start of the latest
quarter to show.

```sql
WITH bounds AS (
  SELECT timestamp '2026-07-01 00:00' AS target_quarter  -- naive SGT
),
quarterly_active_users AS (
  SELECT DISTINCT
    f.user_id,
    date_trunc('quarter', e.created_at AT TIME ZONE 'Asia/Singapore') AS quarter
  FROM executions e
  JOIN flows f ON f.id = e.flow_id
  CROSS JOIN bounds b
  WHERE e.test_run = false
    -- 3 quarters shown, each needing a baseline up to 4 quarters earlier:
    -- (3-1)*3 + 12 = 18 months before target_quarter.
    AND e.created_at >= (b.target_quarter - interval '18 months') AT TIME ZONE 'Asia/Singapore'
    AND e.created_at < (b.target_quarter + interval '3 months') AT TIME ZONE 'Asia/Singapore'
),
quarterly_counts AS (
  SELECT quarter, COUNT(DISTINCT user_id) AS active_users
  FROM quarterly_active_users
  GROUP BY quarter
),
retention AS (
  SELECT
    gap.n AS gap_quarters,
    base.quarter + gap.n * interval '3 months' AS curr_quarter,
    COUNT(DISTINCT base.user_id) AS base_users,
    COUNT(DISTINCT ret.user_id) AS retained_users
  FROM quarterly_active_users base
  CROSS JOIN generate_series(1, 4) AS gap(n)
  LEFT JOIN quarterly_active_users ret
    ON ret.user_id = base.user_id
   AND ret.quarter = base.quarter + gap.n * interval '3 months'
  GROUP BY gap.n, base.quarter
),
shown AS (
  SELECT b.target_quarter - n * interval '3 months' AS curr_quarter
  FROM bounds b, generate_series(0, 2) AS n
)
SELECT
  to_char(sh.curr_quarter, '"Q"Q YYYY') AS quarter,
  COALESCE(qc.active_users, 0) AS active_users,
  r.gap_quarters,
  r.base_users,
  r.retained_users,
  ROUND(100.0 * r.retained_users / NULLIF(r.base_users, 0), 1) AS retention_pct
FROM shown sh
LEFT JOIN quarterly_counts qc ON qc.quarter = sh.curr_quarter
LEFT JOIN retention r ON r.curr_quarter = sh.curr_quarter
ORDER BY sh.curr_quarter, r.gap_quarters;
```

Notes:

- Retention uses the gap definition in [glossary.md](glossary.md).
- `quarter` values are naive SGT. Month offsets apply to the naive value before
  converting back to `timestamptz`.
- No table has a `deleted_at` guard. This is an active-user metric.
- `shown` comes from `generate_series`, so a quarter with no activity still
  appears, with 0 active users.
- An early quarter can lack a baseline for larger gaps. Its row for that gap is
  missing rather than 0.

## 4. Quarter-over-quarter active-user growth

**Question:** "How many active users did we have in Q3 2026 vs. Q2 2026?"

```sql
WITH periods AS (
  SELECT
    timestamp '2026-04-01 00:00' AT TIME ZONE 'Asia/Singapore' AS prev_start,
    timestamp '2026-07-01 00:00' AT TIME ZONE 'Asia/Singapore' AS curr_start,
    timestamp '2026-10-01 00:00' AT TIME ZONE 'Asia/Singapore' AS curr_end
),
counts AS (
  SELECT
    COUNT(DISTINCT f.user_id) FILTER (
      WHERE e.created_at >= p.prev_start AND e.created_at < p.curr_start
    ) AS prev_qtr_active_users,
    COUNT(DISTINCT f.user_id) FILTER (
      WHERE e.created_at >= p.curr_start AND e.created_at < p.curr_end
    ) AS curr_qtr_active_users
  FROM periods p
  JOIN executions e
    ON e.created_at >= p.prev_start AND e.created_at < p.curr_end
  JOIN flows f ON f.id = e.flow_id
  WHERE e.test_run = false
)
SELECT
  prev_qtr_active_users,
  curr_qtr_active_users,
  ROUND(
    100.0 * (curr_qtr_active_users - prev_qtr_active_users) / NULLIF(prev_qtr_active_users, 0),
    2
  ) AS pct_growth
FROM counts;
```

Notes:

- No table has a `deleted_at` guard. This is an active-user metric.
- Q2's count here must equal a single-quarter active-user count for Q2. Use this
  to cross-check.
