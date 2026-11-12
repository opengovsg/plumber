# Objection.js and Knex

Objection builds queries on Knex. These are the places it adds rules that raw
SQL skips. Search the model directory and the Knex config for each one.

| Search for                                                                    | What raw SQL misses                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `static QueryBuilder`, `extends QueryBuilder`, `forClass`                     | A custom query builder. Its `onBuild` hooks add global filters, e.g. `WHERE <table>.deleted_at IS NULL`, to every query. |
| `onBuild`, `context()`                                                        | Which filters apply, and the context flag that turns each one off, e.g. `withSoftDeleted`.                               |
| `delete()` overridden, `static beforeDelete`, `cancelQuery`                   | Soft delete. The delete sets a column instead of removing the row.                                                        |
| `static beforeFind`, `static afterFind`                                       | Filters or transforms applied to every read.                                                                              |
| `static modifiers`                                                            | Named filters. They often define a business term, e.g. "published".                                                       |
| `columnNameMappers`, `snakeCaseMappers`, `knexSnakeCaseMappers`, `wrapIdentifier`, `postProcessResponse` | Column-name mapping. A model's `userId` is the column `user_id`.                                                          |
| `jsonAttributes`, `jsonSchema`                                                | JSON columns. Read their fields with `->>` and cast the result.                                                           |
| `virtualAttributes`                                                           | Fields computed in code. They do not exist in SQL.                                                                        |
| `$formatDatabaseJson`, `$parseDatabaseJson`                                   | Values stored in a different shape from the model.                                                                        |
| `$beforeInsert`, `$beforeUpdate`, `static beforeInsert`, `static beforeUpdate` | Values the app sets or derives, e.g. timestamps or status flags.                                                         |
| `relationMappings`                                                            | Join keys, and join tables for many-to-many relations.                                                                    |
| `static tableName`                                                            | The real table name when it differs from the model name.                                                                  |
| `mixin`, `compose`                                                            | Plugins such as `objection-soft-delete` that add any of the above.                                                        |

## Knex migrations

On Postgres, Knex's `timestamp`, `datetime` and `timestamps()` create
`timestamptz` by default. A second argument of `true` or `{ useTz: false }`,
`specificType`, or raw SQL creates a naive column. Confirm against the live
schema.

## Soft delete

A soft-delete filter appended per table means raw SQL needs one guard per
table, table-qualified. A single bare `deleted_at IS NULL` is ambiguous once
two soft-deleted tables are joined. Some metrics must keep deleted rows. The
team's rules file says which.
