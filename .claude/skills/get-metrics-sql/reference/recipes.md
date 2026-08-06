# Recipes

Worked, end-to-end example queries. Each has every applicable rule from
[gotchas.md](gotchas.md) already applied. These double as the skill's regression examples — if a
generated query for one of these questions looks meaningfully different from its recipe, treat that
as a signal to double-check against [glossary.md](glossary.md)/[gotchas.md](gotchas.md) before
outputting it.

## Recipe 1: pipes with an execution in the past quarter, containing a specific trigger and action

**Question**: "How many pipes have ≥1 execution in the past quarter AND contain the gathersg trigger
AND the slack action?"

```sql
WITH bounds AS (
  SELECT
    (date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore') - interval '3 months' AS quarter_start,
    (date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore') AS quarter_end
)
SELECT COUNT(DISTINCT f.id) AS pipe_count
FROM flows f, bounds b
WHERE f.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM steps s
    WHERE s.flow_id = f.id
      AND s.app_key = 'gathersg'
      AND s.type = 'trigger'
      AND s.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM steps s
    WHERE s.flow_id = f.id
      AND s.app_key = 'slack'
      AND s.type = 'action'
      AND s.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM executions e
    WHERE e.flow_id = f.id
      AND e.test_run = false
      AND e.deleted_at IS NULL
      AND e.created_at >= b.quarter_start
      AND e.created_at < b.quarter_end
  );
```

Notes:
- "gathersg trigger" / "slack action" resolved via [resolving-app-keys.md](resolving-app-keys.md) to
  `app_key='gathersg' AND type='trigger'` and `app_key='slack' AND type='action'`.
- Each app/trigger/action condition and the execution-in-period condition are separate `EXISTS`
  subqueries against `flows`, not joins — a pipe can have many matching `steps`/`executions` rows, and
  joining all three directly would multiply rows and require an extra `DISTINCT` to compensate; `EXISTS`
  avoids that entirely.
- "Past quarter" bounds: `now() AT TIME ZONE 'Asia/Singapore'` converts the current instant to a naive
  SGT wall-clock value, `date_trunc('quarter', ...)` truncates it to the current SGT quarter start, and
  the outer `AT TIME ZONE 'Asia/Singapore'` converts that naive value back to `timestamptz` — a single
  conversion each way, per [gotchas.md](gotchas.md)'s timezone rule. `quarter_start`/`quarter_end` are
  therefore `timestamptz`, directly comparable to `executions.created_at` (also `timestamptz`) with no
  further conversion needed.
- `test_run = false` excludes test executions, per [glossary.md](glossary.md).

## Recipe 2: agency breakdown of owners of published pipes containing an app

**Question**: "What agency (email domain) do the owners of published pipes containing the slack
action mostly come from?"

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
- "Published" = `flows.active = true` (see [glossary.md](glossary.md)'s published-vs-active-pipe
  disambiguation) — not the computed "active pipe" definition.
- "Owner" = `flows.user_id` joined to `users`, not a collaborator.
- "Agency" = email domain via `split_part(u.email, '@', 2)`.

## Recipe 3: quarterly active-user retention (Grafana bar chart, fixed trailing window)

**Question**: "What's the quarter-over-quarter retention rate of active users, as a Grafana bar
chart?" — specifically, retention at 1/2/3/4-quarter gaps (see [glossary.md](glossary.md)'s
gap-based definition), shown as a fixed trailing window of the last 3 quarters regardless of the
selected Grafana time range.

```sql
WITH bounds AS (
  SELECT
    date_trunc(
      'quarter',
      $__timeFrom()::timestamptz AT TIME ZONE 'Asia/Singapore'
    ) AS target_quarter
),
quarterly_active_users AS (
  SELECT DISTINCT
    f.user_id,
    date_trunc(
      'quarter',
      e.created_at AT TIME ZONE 'Asia/Singapore'
    ) AS quarter
  FROM executions e
  JOIN flows f ON f.id = e.flow_id AND f.deleted_at IS NULL
  JOIN users u ON u.id = f.user_id AND u.deleted_at IS NULL
  CROSS JOIN bounds b
  WHERE e.test_run = false
    AND e.deleted_at IS NULL
    -- 3 trailing bars, each needing a baseline up to 4 quarters (12 months)
    -- earlier => pull back (3-1)*3 + 12 = 18 months before target_quarter
    AND e.created_at >= (b.target_quarter AT TIME ZONE 'Asia/Singapore') - interval '18 months'
    AND e.created_at < (b.target_quarter AT TIME ZONE 'Asia/Singapore') + interval '3 months'
),
quarterly_counts AS (
  SELECT quarter, COUNT(DISTINCT user_id) AS active_users
  FROM quarterly_active_users
  GROUP BY quarter
),
retention_1q AS (  -- 1-quarter gap: e.g. Q1 -> Q2
  SELECT
    base.quarter + interval '3 months' AS curr_quarter,
    COUNT(DISTINCT base.user_id) AS base_users,
    COUNT(DISTINCT ret.user_id) AS retained_users
  FROM quarterly_active_users base
  LEFT JOIN quarterly_active_users ret
    ON ret.user_id = base.user_id AND ret.quarter = base.quarter + interval '3 months'
  GROUP BY base.quarter
),
retention_2q AS (  -- 2-quarter gap: e.g. Q1 -> Q3
  SELECT
    base.quarter + interval '6 months' AS curr_quarter,
    COUNT(DISTINCT base.user_id) AS base_users,
    COUNT(DISTINCT ret.user_id) AS retained_users
  FROM quarterly_active_users base
  LEFT JOIN quarterly_active_users ret
    ON ret.user_id = base.user_id AND ret.quarter = base.quarter + interval '6 months'
  GROUP BY base.quarter
),
retention_3q AS (  -- 3-quarter gap: e.g. Q1 -> Q4
  SELECT
    base.quarter + interval '9 months' AS curr_quarter,
    COUNT(DISTINCT base.user_id) AS base_users,
    COUNT(DISTINCT ret.user_id) AS retained_users
  FROM quarterly_active_users base
  LEFT JOIN quarterly_active_users ret
    ON ret.user_id = base.user_id AND ret.quarter = base.quarter + interval '9 months'
  GROUP BY base.quarter
),
retention_4q AS (  -- 4-quarter gap: e.g. Q1 -> Q5
  SELECT
    base.quarter + interval '12 months' AS curr_quarter,
    COUNT(DISTINCT base.user_id) AS base_users,
    COUNT(DISTINCT ret.user_id) AS retained_users
  FROM quarterly_active_users base
  LEFT JOIN quarterly_active_users ret
    ON ret.user_id = base.user_id AND ret.quarter = base.quarter + interval '12 months'
  GROUP BY base.quarter
),
bars AS (
  SELECT b.target_quarter - (n * interval '3 months') AS curr_quarter
  FROM bounds b, generate_series(0, 2) AS n
)
SELECT
  to_char(bar.curr_quarter, '"Q"Q YYYY') AS quarter,
  qc.active_users,

  r1.base_users AS active_users_1q_ago,
  r1.retained_users AS retained_1q,
  ROUND(100.0 * r1.retained_users / NULLIF(r1.base_users, 0), 1) AS retention_1q_pct,

  r2.base_users AS active_users_2q_ago,
  r2.retained_users AS retained_2q,
  ROUND(100.0 * r2.retained_users / NULLIF(r2.base_users, 0), 1) AS retention_2q_pct,

  r3.base_users AS active_users_3q_ago,
  r3.retained_users AS retained_3q,
  ROUND(100.0 * r3.retained_users / NULLIF(r3.base_users, 0), 1) AS retention_3q_pct,

  r4.base_users AS active_users_4q_ago,
  r4.retained_users AS retained_4q,
  ROUND(100.0 * r4.retained_users / NULLIF(r4.base_users, 0), 1) AS retention_4q_pct

FROM bars bar
LEFT JOIN quarterly_counts qc ON qc.quarter = bar.curr_quarter
LEFT JOIN retention_1q r1 ON r1.curr_quarter = bar.curr_quarter
LEFT JOIN retention_2q r2 ON r2.curr_quarter = bar.curr_quarter
LEFT JOIN retention_3q r3 ON r3.curr_quarter = bar.curr_quarter
LEFT JOIN retention_4q r4 ON r4.curr_quarter = bar.curr_quarter
ORDER BY bar.curr_quarter;
```

Notes:
- `executions.created_at` is `timestamptz` (confirmed against the live schema — see
  [gotchas.md](gotchas.md)'s timezone gotcha), so bucketing uses a **single**
  `e.created_at AT TIME ZONE 'Asia/Singapore'` conversion (not a round-trip through UTC), and the
  range filter converts `target_quarter` (naive, from the macro-cast `bounds` CTE) back to
  `timestamptz` once via `AT TIME ZONE 'Asia/Singapore'` before comparing directly against
  `e.created_at`.
- Each retention gap is pre-aggregated to one row per quarter in its own CTE before the final join —
  this avoids a row-multiplying cross join that would happen if the current-quarter set and each
  gap's base/retained sets were all `LEFT JOIN`ed directly off `bars` in one shot (correct via
  `COUNT(DISTINCT ...)` either way, but needlessly expensive).
- Grafana panel config: query format `Table`, visualization `Bar chart`, X-axis = `quarter`,
  `Percent (0-100)` unit on the `retention_*_pct` columns — see [grafana.md](grafana.md).
- `bars` is generated explicitly via `generate_series`, anchored only on `$__timeFrom()` (per
  [grafana.md](grafana.md)'s fixed-trailing-window pattern) — this guarantees exactly 3 bars
  regardless of the selected Grafana time range, and a quarter with zero activity still renders as a
  zero bar rather than a missing one.
- Expect `NULL`s on the higher-gap columns for the earliest displayed bars (e.g. the first bar has no
  4-quarters-ago baseline within the pulled-back window) — that's `NULLIF` correctly producing no
  ratio, not a bug.
- To validate locally, substitute a literal timestamp for `$__timeFrom()` first (see
  [grafana.md](grafana.md)) — `psql` has no macro expansion.
