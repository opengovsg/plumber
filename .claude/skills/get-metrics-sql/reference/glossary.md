# Glossary

Business-term definitions, each mapped to a concrete SQL fragment. Pin down every ambiguous term
against this list before composing a query — several terms collide with each other in ways that
produce a syntactically valid but wrong query if you guess.

## Published pipe vs. active pipe (term collision — read this one first)

These are two unrelated concepts that happen to share the word "active":

- **Published pipe**: `flows.active = true`. A flag the user sets when they publish a pipe. See
  [flow.ts](../../../../packages/backend/src/models/flow.ts).
- **Active pipe**: a pipe with ≥1 *flowed* execution in a given period (see "Flow (verb)" below). Not
  a column — a computed, time-scoped property derived from `executions`.

If a question says "active pipe" without further context, default to the computed definition (flowed
within a period) when the question is about usage/engagement, and to `flows.active = true` when it's
about publish state. When genuinely ambiguous, ask rather than guess.

## Flow (verb): to execute a pipe on non-test data

"Flow" as a verb means: an `executions` row exists with `test_run = false`. This is the building block
for "active pipe" and "active user" below.

## Active user

A user with ≥1 flowed pipe within a given period. There is no direct `executions.user_id` — join
through `flows.user_id`:

```sql
SELECT DISTINCT f.user_id
FROM executions e
JOIN flows f ON f.id = e.flow_id AND f.deleted_at IS NULL
WHERE e.test_run = false
  AND e.deleted_at IS NULL
  AND e.created_at >= <period_start> AND e.created_at < <period_end>
```

(Period bounds must be computed in SGT — see [gotchas.md](gotchas.md)'s timezone rule — before being
compared against `executions.created_at`, which is `timestamptz`.)

## Quarter

A calendar quarter, half-open bounds. E.g. Q2'2026 = `[2026-04-01 00:00, 2026-07-01 00:00)` in SGT.
Always compute quarter boundaries in SGT — see [gotchas.md](gotchas.md)'s timezone rule for the
correct single-conversion pattern for these `timestamptz` columns. Same pattern applies to month/day
bucketing.

## N-quarter retention (gap-based, not span-based)

N-quarter retention means the target quarter is **N quarters after** the baseline quarter:

- 1-quarter retention: Q1 → Q2
- 2-quarter retention: Q1 → Q3
- 3-quarter retention: Q1 → Q4
- 4-quarter retention: Q1 → Q5

This is a **gap**, not a span — "3-quarter retention" is *not* "a 3-quarter-wide window" (which would
read as Q1→Q3); it's "the quarter 3 quarters after baseline" (Q1→Q4). See
[recipes.md](recipes.md) for the full worked retention query using this convention.

## Pipe contains app X

An `EXISTS` check over `steps`:

```sql
EXISTS (
  SELECT 1 FROM steps s
  WHERE s.flow_id = f.id
    AND s.app_key = '<app_key>'
    AND s.deleted_at IS NULL
)
```

Resolve the app's display name → `app_key` per [resolving-app-keys.md](resolving-app-keys.md). Add
`AND s.type = 'trigger'` / `'action'` and `AND s.key = '<key>'` if the question names a specific
trigger/action rather than just the app.

## Execution in period (and the testRun exclusion)

`executions.created_at` within the target window, table-qualified and soft-delete-guarded, **and**
`test_run = false` unless the user explicitly asks about test runs:

```sql
e.created_at >= <period_start> AND e.created_at < <period_end>
AND e.test_run = false
AND e.deleted_at IS NULL
```

## Agency

The email domain of `users.email`:

```sql
split_part(u.email, '@', 2) AS agency
```

## Owner vs. collaborator

`flows.user_id` is the pipe's **owner**. Collaborators are a separate relation
(`flow_collaborators`, via `Flow.collaborators` in
[flow.ts](../../../../packages/backend/src/models/flow.ts)) with roles `owner` / `editor` / `viewer`
(`IFlowCollabRole`) — a distinct concept from ownership. Default to owner (`flows.user_id`) unless the
question explicitly says "collaborator" or "shared with."

## Trigger vs. action

`steps.type` is `'trigger'` or `'action'`. A pipe has exactly one trigger step and 0+ action steps —
see `getTriggerStep()` / the `type` filters in
[step.ts](../../../../packages/backend/src/models/step.ts).
