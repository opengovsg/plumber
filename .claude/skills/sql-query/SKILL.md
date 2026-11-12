---
name: sql-query
description: Read when a task needs a SQL query against a product's own database or its read replica. Use it to compute a metric, explore a schema or check a query before handing it over. It connects read-only, recovers rules the app applies outside the database, and keeps queries safe for production.
---

# SQL query

Product facts live in the repo's team context, `docs/analytics/team/`. Read its
`README.md` for the reporting time zone and the rules file. Read the
database's entry in `sources.md` for the connection, engine, ORM, large tables,
local dev database and test-data exclusion. If a fact you need is missing, ask
the user. For Postgres, also read [postgres.md](postgres.md).

## 1. Connect

Use the connection the entry names:

- **SQL MCP tool.** Call the tool and saved connection the entry names. If
  the tool has a read-only variant, use only that variant.
- **Localhost tunnel to a read replica.** Ask the user to open the tunnel.
  Connect with the client and endpoint the entry names.

Never ask for, read or print a database password. Never read `.env` or other
credential files, e.g. `~/.pgpass`. If no connection is available, check the
query against the local dev database the entry names, if any. Report the
answer as `not run`.

## 2. Stay read-only

Never run `INSERT`, `UPDATE`, `DELETE` or DDL. Wrap every query in the engine
guide's read-only transaction, even on a replica. If an MCP tool enforces
read-only itself and rejects the wrapper, rely on the tool and say so in the
hand-over.

## 3. Discover the live schema

Read column names and types from the live database, e.g.
`information_schema.columns`. Model files explain what a column means. The
live schema decides its name and type. A migration's call shape can hide the
real column type.

## 4. Recover rules the app applies outside the database

Raw SQL skips the rules the app's data layer adds, e.g. soft-delete filters,
default scopes, tenant scoping, column-name mapping, and display names or
enums defined in code. The rules file lists the known ones. Apply each, plus
the entry's test-data exclusion, unless a counting rule says otherwise. To find
unlisted rules, read the guide for the app's ORM:

- [Objection.js](orm/objection.md)

For another ORM, search the schema or model definitions, query hooks or
middleware, and shared query helpers for global filters, name mapping and enum
mapping.

## 5. Protect production

- Check the size of each table before aggregating it. The entry names the
  known large tables.
- Run `EXPLAIN` before a query that scans a large table.
- Set a statement timeout, and add the engine guide's memory guard for large
  tables. If the connection rejects settings, rely on `EXPLAIN` and the
  tool's own timeout. Say in the hand-over that the guard was not applied.
- Add `LIMIT` to exploration queries.

## 6. Keep personal data out of answers

Return aggregates. Do not print emails, names, tokens or IDs row by row. Use
a field derived from personal data only when the team's glossary defines it,
e.g. an email domain for an organisation.

## 7. Validate and hand over

Check syntax first with `EXPLAIN` or `LIMIT 0`. Fix errors up to three times,
then report the error. Hand over:

- the final SQL in a fenced block, with its guards,
- the assumptions, including the test-data exclusion and every relaxed rule
  from step 4 with its reason,
- the result, or `not run`.
