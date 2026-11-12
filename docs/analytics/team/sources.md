# Where Plumber's data lives

## Which source for what

| Question                                                         | Source   | Skill                   | Status   |
| ---------------------------------------------------------------- | -------- | ----------------------- | -------- |
| Pipes, executions, users, connections and anything they imply    | Postgres | `sql-query`             | official |
| What users do in the builder UI, page views, front-end errors    | PostHog  | `querying-posthog-data` | live     |
| Service health, latency, server errors and cost                  | Datadog  | Datadog MCP skills      | live     |

Plumber is moving product metrics to PostHog. Until a metric is listed here as
official in PostHog, answer it from Postgres.

## Postgres

The app's main database. Production runs Postgres 18. The local dev container
runs Postgres 14. The app reads and writes it through Objection.js. Models live
in [packages/backend/src/models/](../../../packages/backend/src/models/).

**Connection.** Use the TablePlus MCP tool `execute_read_query`.

- Production: the read replica, database `plumber_prod`, through the TablePlus
  connection "Plumber Prod - readonly user". Find its ID with
  `list_connections`. Never use the "Plumber Prod" connection. It logs in as a
  superuser.
- The user opens the tunnel and opens the connection in TablePlus. If a query
  fails with "Database is disconnected", ask the user to do both.
- `execute_read_query` runs each call in its own read-only transaction. It
  rejects `BEGIN` and `SET`, so the memory guard cannot be applied. Calls time
  out after at most 300 seconds, and the server cancels the query. Split a
  longer query by period only when the metric sums across periods. Distinct
  counts do not.
- Never use `execute_query`. It runs any SQL.
- Local dev database, for syntax checks only: the TablePlus connection
  "plumber-local", database `plumber_dev`, from the `postgres` service in
  [docker-compose.dev.yml](../../../packages/backend/docker-compose.dev.yml).
  It holds test data only, so its counts mean nothing. The user starts it with
  `pnpm run setup`. Do not start it yourself.

**Freshness.** The replica lags production by seconds. Rows are complete for
any period that has ended.

**Test data.** Exclude `executions.test_run = true` from execution counts,
unless the user asks for test runs.

**Large tables.** `execution_steps` is the largest table by far, with one row
per step per execution. Run `EXPLAIN` before any query that reads it.
Neither it nor `executions` has an index that starts with `created_at`, so a
period filter alone scans the whole table. Narrow `execution_steps` through an
indexed column instead: `(app_key, key)`, `execution_id` or `step_id`. A
period filter on `executions` is a full scan too, but `executions` is far
smaller.

**Server settings.** The replica sets `max_parallel_workers_per_gather = 0`
and `jit = off`, and its time zone is UTC.

**Timestamps.** `created_at`, `updated_at`, `deleted_at` and `published_at` on
`flows`, `steps`, `executions`, `execution_steps`, `users` and `connections`
are `timestamptz`.

## PostHog

The front end sends events, exceptions and a 10% sample of session replays
([posthog.ts](../../../packages/frontend/src/posthog.ts)). It identifies a
signed-in user by `users.id`. The backend sends AI builder LLM traces. No
metric is official in PostHog yet. Find the project with the PostHog MCP.

## Datadog

Live server metrics, logs, traces and RUM. Use the Datadog MCP.

## Data changes

| Date        | Change                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 27 Mar 2023 | `execution_steps.app_key` added. Earlier rows have no app key, so app-level activity before this date cannot be counted from `execution_steps`. |
| 12 Oct 2023 | `executions.status` added. Earlier executions have no status, so success and failure counts start here.                                     |
| 6 Jun 2025  | `execution_steps.key` added. Filter on the trigger or action key only for periods after this date.                                             |

Dates are the migration dates. The deploy that ran each migration may be a few
days later.
