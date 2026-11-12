# Plumber team analytics context

The analytics skills (`analytics-guide`, `sql-query`) hold the method for any
product. This folder holds only Plumber's facts. Each fact has one home. When a
fact changes, change it in its home and link to it from everywhere else.

| Fact                                                                                | Home                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Each source: skill, connection, test-data exclusion, large tables, freshness        | [sources.md](sources.md)                                                       |
| Changes that alter what a number counts, by date                                    | [sources.md#data-changes](sources.md#data-changes)                             |
| Business terms such as "active user", "published pipe" and "agency"                 | [glossary.md](glossary.md)                                                     |
| SQL counting rules, schema traps and rules the app applies outside the database     | [gotchas.md](gotchas.md)                                                       |
| Converting app, trigger and action display names to stored keys                     | [name-resolution.md](name-resolution.md)                                       |
| Saved definitions                                                                    | [saved-queries.md](saved-queries.md). PostHog has none yet.                    |
| What a column means                                                                  | The [model files](../../../packages/backend/src/models/). The live schema decides names and types. |
| Dashboards                                                                           | None yet.                                                                      |
| Topic guides                                                                         | None yet.                                                                      |
| Lineage                                                                              | None. The app writes straight to Postgres.                                     |

## Reporting conventions

- **Reporting time zone:** `Asia/Singapore` (SGT). Bucket days, months and
  quarters in SGT.
- **Metric owners:** not yet recorded. Ask the user who owns a metric before
  changing its definition.
- **Product terms:** Plumber's UI calls a flow a "pipe". The database calls it a
  `flow`.
