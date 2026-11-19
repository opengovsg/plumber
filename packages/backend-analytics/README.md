# backend-analytics

The analytics export library. It reads Postgres and writes the silver tables as Parquet files to S3, where PostHog reads them.

It has no entry point of its own. The archival task in [`backend-archive`](../backend-archive/README.md#exporting-analytics-tables) runs it each night, before it archives. Archival must not delete executions before the export reads them, so both run in one task.

`backend-archive` imports the built `dist/`. Its scripts build this package first.

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
  - IMPORTANT: changing an existing value does not refresh steps that have not changed since. After that change deploys, run `analytics:export --tables flow_step --full --s3` in each environment.

---

## Running tests

```bash
pnpm --filter backend-analytics run test:unit
```

The integration tests run each export query against Postgres 18, migrated with `packages/backend`'s migrations. They need Docker running.

```bash
pnpm --filter backend-analytics run test:integration
```

A migration that renames or drops a column an export reads fails these tests in CI. Add an `*.itest.ts` for every new export table.
