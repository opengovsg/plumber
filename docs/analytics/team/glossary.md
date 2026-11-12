# Glossary

Each business term maps to a SQL fragment. Several terms collide, and a wrong
guess gives a query that runs but counts the wrong thing.

## Published pipe vs. active pipe

These two unrelated terms share the word "active":

- **Published pipe**: `flows.active = true`. The user sets this flag when they
  publish a pipe. See [flow/index.ts](../../../packages/backend/src/models/flow/index.ts).
- **Active pipe**: a pipe with at least one _flowed_ execution in a period. It
  is computed from `executions`, not stored. Deleted pipes count too. See the
  activity-metrics exception in [gotchas.md](gotchas.md).

For a usage or engagement question, "active pipe" means the computed term. For
a question about publish state, it means `flows.active = true`. If the question
does not make this clear, ask.

## Flow (verb)

To flow a pipe is to execute it on real data: an `executions` row with
`test_run = false`. "Active pipe" and "active user" build on this.

## Active user

A user who owns at least one pipe that flowed in the period. `executions` has
no `user_id`, so join through `flows.user_id`:

```sql
SELECT DISTINCT f.user_id
FROM executions e
JOIN flows f ON f.id = e.flow_id
WHERE e.test_run = false
  AND e.created_at >= <period_start> AND e.created_at < <period_end>
```

No table gets a `deleted_at` guard. A user who flowed a pipe in the period stays
active after deleting the pipe or their account.

## Quarter

A calendar quarter in SGT, with half-open bounds. Q2 2026 is
`[2026-04-01 00:00, 2026-07-01 00:00)` SGT. Months and days follow the same
rule.

## N-quarter retention

The share of a baseline quarter's active users who are active again **N
quarters after** it. N is a gap, not a window width:

- 1-quarter retention: Q1 → Q2
- 2-quarter retention: Q1 → Q3
- 3-quarter retention: Q1 → Q4
- 4-quarter retention: Q1 → Q5

See [saved-queries.md](saved-queries.md) for the worked query.

## Pipe contains app X

For a pipe's current steps, use an `EXISTS` check over `steps`:

```sql
EXISTS (
  SELECT 1 FROM steps s
  WHERE s.flow_id = f.id
    AND s.app_key = '<app_key>'
    AND s.deleted_at IS NULL
)
```

Add `AND s.type = 'trigger'` or `'action'`, and `AND s.key = '<key>'`, when the
question names a specific trigger or action. Resolve names with
[name-resolution.md](name-resolution.md).

For "used" or "ran app X in the period", check `execution_steps.app_key`
instead. See Saved query 1. "Has" or "contains" means the current steps.

## Execution in period

```sql
e.created_at >= <period_start> AND e.created_at < <period_end>
AND e.test_run = false
AND e.deleted_at IS NULL
```

Drop `e.deleted_at IS NULL` for active-user and active-pipe metrics.

## Agency

The email domain of the user:

```sql
split_part(u.email, '@', 2) AS agency
```

## Owner vs. collaborator

`flows.user_id` is the pipe's **owner**. Collaborators live in
`flow_collaborators`, with roles `owner`, `editor` and `viewer`. Count the owner
unless the question says "collaborator" or "shared with".

## Trigger vs. action

`steps.type` is `'trigger'` or `'action'`. A pipe has exactly one trigger step
and zero or more action steps.
