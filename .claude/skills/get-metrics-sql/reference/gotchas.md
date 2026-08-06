# Gotchas

Rules that are **not** visible from reading a single model file. Reading `flow.ts`, `step.ts`,
`execution.ts`, etc. gets you most of the way to correct SQL — these are the traps that bite anyway,
because the behavior lives elsewhere (a query-builder hook, a config file, a Postgres quirk) or is a
naming inconsistency across tables.

## 1. Soft-delete auto-append

The ORM's `ExtendedQueryBuilder`
([packages/backend/src/models/query-builder.ts:18-22](../../../../packages/backend/src/models/query-builder.ts#L18-L22))
auto-appends a soft-delete guard to every query it builds:

```ts
qb.onBuild((builder) => {
  if (!builder.context().withSoftDeleted) {
    builder.whereNull(`${qb.modelClass().tableName}.${DELETED_COLUMN_NAME}`)
  }
})
```

That's `WHERE <table>.deleted_at IS NULL`, table-qualified. Raw SQL gets none of this — add it back
manually by default, **once per table referenced, table-qualified** (matching how the ORM does it
internally), not as a single bare `deleted_at IS NULL` once several soft-deleted tables are joined.

This is a default, not an absolute — a specific question may intentionally want deleted rows included
for a given table (e.g. an audit/reconciliation count), or simply not care about that table's
soft-delete state. Relax the guard only for the table(s) the question actually calls for, ask if it's
unclear which, and say so explicitly in the query's explanation — don't drop it silently, and don't
drop it for tables the question didn't ask about.

All 6 of these tables carry a real `deleted_at` column
([20220928162525_soft-delete-base-model.ts](../../../../packages/backend/src/db/migrations/20220928162525_soft-delete-base-model.ts)):

- `flows`
- `steps`
- `executions`
- `execution_steps`
- `users`
- `connections`

Example, table-qualified in a join:

```sql
FROM executions e
JOIN flows f ON f.id = e.flow_id AND f.deleted_at IS NULL
WHERE e.deleted_at IS NULL
```

## 2. Timezone: columns are `timestamptz` — a single conversion, not a round-trip

`created_at` / `updated_at` / `deleted_at` / `published_at` on all 6 core tables (`flows`, `steps`,
`executions`, `execution_steps`, `users`, `connections`) are **`timestamp with time zone`** in the
live schema — confirmed via `\d <table>` against the dev Postgres container, not by reading migration
source.
This is easy to get backwards: the migrations declare them with the unassuming
`table.timestamps(true, true)`
([20220219093113_create_executions.ts](../../../../packages/backend/src/db/migrations/20220219093113_create_executions.ts)
is a representative example), which reads like it might produce a naive `timestamp` column. It
doesn't — Knex's Postgres column compiler defaults `useTz` to `true` whenever no explicit options
object is passed to the underlying `.timestamp()` call, so the bare, no-options form actually
produces `timestamptz`. **Don't infer naive-vs-tz-aware from the migration call shape** — confirm
against the live schema (`\d <table>` in psql, or query `information_schema.columns`) before deciding
how to handle timezones in a query. (There is currently no genuinely naive timestamp column anywhere
in this codebase — no migration sets `useTz: false` — but a future one could, so always verify rather
than assume.)

The org's business/display convention is SGT:
`LuxonSettings.defaultZone = 'Asia/Singapore'`
([packages/backend/src/config/app.ts:288](../../../../packages/backend/src/config/app.ts#L288)).

**Rule, for a confirmed tz-aware (`timestamptz`) column** — the common case here — a **single**
conversion is correct; do not round-trip through UTC first:

```sql
-- Bucketing: timestamptz -> naive SGT wall-clock, then truncate
date_trunc('quarter', created_at AT TIME ZONE 'Asia/Singapore')

-- Comparing against a literal SGT boundary: naive -> timestamptz, compare directly
created_at >= (timestamp '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Singapore')
```

Applying an extra `AT TIME ZONE 'UTC'` first (i.e. `(created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Singapore'`)
is **wrong** for a `timestamptz` column — it double-shifts the value by the SGT offset and hands
`date_trunc` a second `timestamptz` back (session-timezone-dependent truncation) instead of a plain
`timestamp`. Confirmed firsthand: this pattern truncated an instant that is `2026-04-01 03:00` in SGT
(unambiguously Q2 2026) down to `2026-01-01 00:00` — Q1 — a full quarter off. The single-conversion
form above truncates the same instant correctly to `2026-04-01 00:00` (Q2).

**If a column is genuinely naive** (verified against the live schema, not assumed) — e.g. it was
declared with an explicit `useTz: false` — then *that* column needs the round-trip instead:

```sql
date_trunc('quarter', (naive_created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Singapore')
```

Always check which case you're in before writing the query.

## 3. Postgres function-overload ambiguity

Passing an untyped literal into an overloaded function like `date_trunc` fails:

```
ERROR: function date_trunc(unknown, unknown) is not unique (42725)
```

This bites Grafana macros specifically: `$__timeFrom()` / `$__timeTo()` expand to untyped
UTC-instant literals. Fix with an explicit cast matching the target column's actual type
(`::timestamptz` for the tz-aware columns in this codebase — see gotcha 2; `::timestamp` only if you've
confirmed the specific column you're comparing against is genuinely naive):

```sql
date_trunc('quarter', $__timeFrom()::timestamptz AT TIME ZONE 'Asia/Singapore')
```

See [grafana.md](grafana.md) for the full Grafana-specific ruleset.

## 4. `connections.key` is actually the app key — naming diverges from `steps.app_key`

On `steps`, the app is identified by the `app_key` column. On `connections`, the *same concept* (which
app this connection/credential belongs to, e.g. `'slack'`) is stored in a column just called `key` —
there is no separate `app_key` column on `connections`. Confirmed by usage across the codebase, e.g.
`packages/backend/src/graphql/mutations/update-step.ts:64`: `connection.key !== input.appKey`
(comparing a connection's `key` directly against a step's `appKey`).

**Rule**: when a question involves which app a connection belongs to, filter on `connections.key`, not
`connections.app_key` (that column doesn't exist). Don't confuse this with `steps.key`, which is the
trigger/action key (e.g. `'sendMessageToChannel'`) — same column name, different meaning, different
table.

## 5. `execution_steps` is large and growing on prod — guard against OOM

`execution_steps` (one row per step per execution) is the highest-volume table by far of the 6, and
prod's database instance has limited memory relative to its size. A query that aggregates, joins, or
sorts over it can get OOM-killed, especially if the planner parallelizes across several workers (each
claiming its own `work_mem`) or picks a hash join/aggregate sized more generously than the instance
can actually give it.

**Rule**: when the final query touches `execution_steps` directly — or does any other large-scale
aggregation you're not confident fits comfortably in memory — wrap it in this memory-conservative
settings guard before handing it to the user for **prod** execution (this is separate from, and in
addition to, the local-validation wrapper in [SKILL.md](../SKILL.md) step 5, which runs against the
container's tiny dev data and doesn't need it):

```sql
BEGIN;
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL hash_mem_multiplier = 1.0;
SET LOCAL jit = off;
SET LOCAL enable_memoize = off;

-- … the query …

COMMIT;
```

`SET LOCAL` scopes each change to the current transaction only — confirmed (against the dev Postgres
container) to auto-revert at `COMMIT`, so it never leaks into the rest of the `psql` session.
Prod and the dev container run the same Postgres version (the team keeps them in sync), so a query and
this settings guard both working against the dev container is the practical signal that they'll work
against prod too — check the running version with `SELECT version();` if you need to confirm a
specific GUC or syntax is available, rather than assuming a version number.

What each setting does (verify against `pg_settings` on whichever Postgres version you're targeting,
rather than assuming — behavior below was confirmed against the dev container's Postgres 14):

- `max_parallel_workers_per_gather = 0` — disables parallel workers for this transaction. Each
  parallel worker gets its own `work_mem`, so parallelism multiplies peak memory per node; disabling
  it trades query speed for a lower, more predictable ceiling. Has a real effect (default is `2`).
- `jit = off` — skips JIT compilation of expressions, removing one more source of per-query memory
  overhead on a large scan. Has a real effect (default is `on`).
- `enable_memoize = off` — this skill's recipes lean heavily on correlated `EXISTS` subqueries (see
  [recipes.md](recipes.md)), which Postgres can turn into a nested loop with a Memoize cache keyed on
  the outer row. Memoize's cache sizing depends on planner ndistinct estimates, which can be badly
  wrong at large scale; disabling it trades some CPU (subqueries re-execute instead of being cached)
  for a more predictable memory footprint. Has a real effect (default is `on`; requires PG14+ — check
  `SELECT version();` if targeting an older Postgres).
- `hash_mem_multiplier = 1.0` — on PG13/14, this is a no-op: the built-in default (`boot_val`) is
  already `1`. It only defaults to `2` from PG15 onward. Harmless to keep in the snippet regardless
  (protects against a future major-version upgrade silently doubling hash memory) — check
  `SHOW hash_mem_multiplier;` if you want to confirm which case applies on the version you're running
  against.

**Don't apply this by default to every query** — it trades speed for memory safety, and most queries
in this skill (against `flows`/`steps`/`users`/`connections`, which are far smaller than
`execution_steps`) don't need it. Reach for it specifically when `execution_steps` is in the query, or
when a query aggregates over a row count you're not confident fits in memory.

## 6. `status` means a different thing on each of `steps`, `executions`, and `execution_steps`

Three different tables each have their own `status` column, and they are **not** the same concept —
don't assume a `status` filter written for one table applies to another:

- `steps.status`: `'incomplete' | 'completed'` — whether the step's own configuration/setup is
  complete, not anything about execution. A step can be `'completed'` (fully configured) and still
  never have run, or have run and failed.
- `executions.status`: `'success' | 'failure' | null` — the outcome of the whole execution. `null`
  means the execution is still in progress/pending, not a third terminal outcome — don't treat
  `status IS NULL` as an error case.
- `execution_steps.status`: `'success' | 'failure'` — the outcome of one individual step's run within
  a specific execution (no `null`/pending state at this granularity).

If a question asks about "failed executions" or "successful steps," pin down which of these three it
actually means (execution-level outcome vs. individual-step-run outcome vs. step-configuration state)
before writing the filter, and check [glossary.md](glossary.md) if the business term is ambiguous.
