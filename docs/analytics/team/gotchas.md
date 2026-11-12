# SQL counting rules and schema traps

Rules that one model file does not show.

## 1. Soft delete

The ORM's query builder
([query-builder.ts](../../../packages/backend/src/models/query-builder.ts))
appends `WHERE <table>.deleted_at IS NULL` to every query. Raw SQL does not.
These 6 tables have a real `deleted_at` column:

- `flows`
- `steps`
- `executions`
- `execution_steps`
- `users`
- `connections`

By default, add one guard per table, table-qualified:

```sql
FROM executions e
JOIN flows f ON f.id = e.flow_id AND f.deleted_at IS NULL
WHERE e.deleted_at IS NULL
```

A question may need deleted rows for a table, e.g. an audit count. Relax the
guard only for that table. Ask if unclear, and name each relaxed table in the
answer.

**Exception: activity metrics never filter soft-deleted rows.** For an
active-user or active-pipe count, drop the guard on every table. Deleting a pipe
soft-deletes its executions and steps
([delete-flow.ts](../../../packages/backend/src/graphql/mutations/delete-flow.ts)).
A guarded query drops users who flowed a pipe and later deleted it, so past
periods' counts shrink over time. To check which apps a pipe ran, read
`execution_steps.app_key`, not `steps`. Deleting a pipe or step leaves its
`execution_steps` rows in place.

## 2. `connections.key` is the app key

`steps` names the app in `app_key`. `connections` names it in `key`. There is no
`connections.app_key`. Do not confuse `connections.key` with `steps.key`, which
is the trigger or action key, e.g. `'sendMessageToChannel'`.

## 3. `status` means something different on each table

- `steps.status`: `'incomplete' | 'completed'`. Whether the step's setup is
  complete. It says nothing about runs.
- `executions.status`: `'success' | 'failure' | null`. The whole execution's
  outcome. `null` means still running, not a third outcome.
- `execution_steps.status`: `'success' | 'failure'`. One step's outcome within
  one execution.

For "failed executions" or "successful steps", pin down which of these the
question means.

## 4. App keys before 2023 and step keys before 2025

`execution_steps.app_key` and `execution_steps.key` start partway through
Plumber's history. See [sources.md#data-changes](sources.md#data-changes).
