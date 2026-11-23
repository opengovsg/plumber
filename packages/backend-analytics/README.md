# backend-analytics

The analytics export library. It reads Postgres and writes the silver tables as Parquet files to S3, where PostHog reads them.

It has no entry point of its own. The archival task in [`backend-archive`](../backend-archive/README.md#exporting-analytics-tables) runs it each night, before it archives. Archival must not delete executions before the export reads them, so both run in one task.

`backend-archive` imports the built `dist/`. Its scripts build this package first.

---

## What the export writes

Each table becomes one Parquet file at `silver/<table>/current.parquet`, replaced on every run.

| Table           | One row per                                       |
| --------------- | ------------------------------------------------- |
| `flow_transfer` | Pipe ownership transfer.                          |
| `dim_user`      | User, including soft-deleted users. Holds emails. |

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
