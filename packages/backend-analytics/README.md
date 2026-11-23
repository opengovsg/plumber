# backend-analytics

The analytics export library. It reads Postgres and writes the silver tables as Parquet files to S3, where PostHog reads them.

It has no entry point of its own. The archival task in [`backend-archive`](../backend-archive/README.md#exporting-analytics-tables) runs it each night, before it archives. Archival must not delete executions before the export reads them, so both run in one task.

`backend-archive` imports the built `dist/`. Its scripts build this package first.

---

## What the export writes

Each table becomes one Parquet file at `silver/<table>/current.parquet`, replaced on every run.

| Table                | One row per                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| `flow_transfer`      | Pipe ownership transfer.                                                              |
| `dim_user`           | User, including soft-deleted users. Holds emails.                                     |
| `flow_stage`         | Pipe, with its creator, owner and creation path.                                      |
| `flow_access`        | User with access to a pipe: owner, editor or viewer.                                  |
| `flow_ai_suggestion` | Step the AI Builder proposed for a pipe. Join `flow_step` on `step_id`, not position. |
| `action_catalog`     | Trigger or action in the app registry, removed ones included.                         |

The export writes only when `APP_ENV` is `prod` or `staging`. Each environment has its own bucket. PostHog reads a bucket only if someone attaches it.

Timestamps use the Parquet `TIMESTAMP(isAdjustedToUTC=true, MILLIS)` type, so DuckDB and ClickHouse read them as UTC.

---

## Agency mapping

Two files in `data/` map email domains to agencies. The export reads them at runtime.

| File                 | Columns                                | Holds                                                                      |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `agencies.csv`       | `canonical`, `agency_name`, `category` | One row per agency. `canonical` is its main email domain.                  |
| `agency-domains.csv` | `domain`, `canonical`                  | One row per email domain, including subdomains, renamed domains and typos. |

A domain with no row falls back to its parent domain. `gt.tech.gov.sg` tries `tech.gov.sg`. The lookup never falls back to `gov.sg`, `edu.sg`, `com.sg` or `sg`. A domain that still has no match is `unclassified`. `dim_user` takes `agency`, `agency_name` and `agency_category` from this lookup. Its `is_internal` is true for every domain that maps to OGP.

Each `dim_user` export logs two lists with verified-user counts:

- `analytics.agency.unclassified`: domains with no match. Add a row for any you can identify.
- `analytics.agency.fallback`: domains that matched only through a parent domain.

IMPORTANT: the files are public. Add only government domains and public bodies. Never add user counts.

---

## Action catalog

`action_catalog` reads `data/action-catalog.csv`, one row per trigger and action. The backend apps test fills `name`, `is_trigger` and `is_active` from the apps registry. A removed trigger or action keeps its row with `is_active` false.

- After adding, renaming or removing a trigger or action, run `pnpm --filter backend exec vitest run src/apps/__tests__/index.test.ts -u` and commit the file. In CI, a stale file fails that test.
- `launched_at` is typed by hand (`YYYY-MM-DD`, Singapore). A blank cell means nobody has entered it. Regenerating keeps every date.
- `resource_parameter` is typed by hand. It names the argument that holds the table, file, channel or other resource a step points at, or `none`. `flow_step.resource_id` reads that argument. The test fails while a cell is blank or names an argument the app-action lacks. Regenerating keeps every value.

## Tracking finished days

An export written as one file set per Singapore day marks each finished day with a completion file. The code lives in `src/day-completion.ts`.

- The file sits at `bronze/_completion/<job>/day=YYYY-MM-DD.v<version>.json`. A full copy adds `.full` before `.json`. It sits under `bronze/` because the archival role writes only `bronze/` and `silver/`, and PostHog reads only `silver/`.
- It is written after all of the day's files, so a failed run leaves the day unmarked. Its body lists those files and whether the nightly run or a manual command wrote it.
- A completion file counts only while every file it lists is older than it. A rewrite that stopped part-way, or an older checkout that overwrote the day, leaves newer files, so the day is redone and logs `analytics.export.completion.outdated`. Only the last 30 days and the latest full copy are checked.
- A run refuses to write a day that a newer version already wrote. Update your checkout instead.
- Each night redoes every day in the last 7, through yesterday, with no current completion file at the job's version.
- A day that fails does not hold back later days. It stays unmarked for the next run, logs `analytics.export.day.error`, and the run still fails.
- A job's first run writes `bronze/_completion/<job>/start=YYYY-MM-DD.json` before it starts. The date is the earliest day the run writes: yesterday at night, or the earliest requested day in a backfill. Days before that marker and the first completion file are history, so the first night after release never rewrites history. A first day that fails is still owed. A full copy covers every earlier day.
- Each run logs `analytics.export.coverage` per job, even when the export fails: `missingDays` in the last 30 days, `firstMissing`, `lastMissing` and `staleDays`. `staleDays` includes a full copy from an older version. A Datadog monitor alerts when `missingDays` is above zero. When the completion files cannot be listed, the run logs `analytics.export.coverage.unavailable` instead.

---

## Running tests

Run checks and builds through Turbo, as CI does. Turbo builds `@plumber/backend-models` first. The bare package scripts fail with `TS2307` on a clean checkout.

```bash
pnpm exec turbo run typecheck --filter=backend-analytics
pnpm exec turbo run test:unit --filter=backend-analytics
```

The integration tests run each export query against Postgres 18, migrated with `packages/backend`'s migrations. They need Docker running.

```bash
pnpm exec turbo run test:integration --filter=backend-analytics
```

The script migrates a fresh database on each run. A watch or UI session migrates only when it starts, so restart it after editing a migration.

A migration that renames or drops a column an export reads fails these tests in CI. Add an `*.itest.ts` for every new export table.
