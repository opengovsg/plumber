# Postgres

## Read-only wrapper

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5min';

-- the query

ROLLBACK;
```

With `psql`, pipe the block on stdin or pass it with `-f`, and add
`-v ON_ERROR_STOP=1`. IMPORTANT: psql 14 and earlier print only the last
result of a single `-c`, so the query's output is lost.

## Live schema

```sql
SELECT table_schema, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_name = '<table>'
  AND table_schema NOT IN ('pg_catalog', 'information_schema');
```

`timestamp with time zone` is `timestamptz`. `timestamp without time zone` is
naive. Check each column you bucket or compare. `udt_name` shows the real type
when `data_type` says `USER-DEFINED` or `ARRAY`.

Postgres folds unquoted identifiers to lowercase. Double-quote mixed-case
names, e.g. `"User"."createdAt"`.

## Time zones

Replace `<tz>` with the reporting time zone from the team context. Write every
local boundary as `timestamp '…' AT TIME ZONE '<tz>'`. A bare literal such as
`'2026-04-01'::timestamptz` is read in the session time zone.

### `timestamptz` columns: one conversion

```sql
-- Bucket: convert to a naive local value, then truncate.
date_trunc('quarter', created_at AT TIME ZONE '<tz>')

-- Compare against a local boundary.
created_at >= (timestamp '2026-04-01 00:00' AT TIME ZONE '<tz>')
```

IMPORTANT: never convert a `timestamptz` through `'UTC'` first. That shifts the
value twice and can move an instant into the wrong quarter.

### Naive columns holding UTC: two conversions

```sql
-- Bucket
date_trunc('quarter', (naive_col AT TIME ZONE 'UTC') AT TIME ZONE '<tz>')

-- Compare against a local boundary
naive_col >= (timestamp '2026-04-01 00:00' AT TIME ZONE '<tz>') AT TIME ZONE 'UTC'
```

Compare a naive UTC column with `now() AT TIME ZONE 'UTC'`, never bare `now()`.

### Month arithmetic and series

Do month arithmetic and `generate_series` on naive local values, then convert
each result back:

```sql
-- start of the previous quarter, as timestamptz
(date_trunc('quarter', now() AT TIME ZONE '<tz>') - interval '3 months') AT TIME ZONE '<tz>'
```

IMPORTANT: never add months to a `timestamptz` or generate a monthly series of
`timestamptz`. The math runs in the session time zone and can shift a boundary
by a day.

### Intervals

Use half-open intervals: `>= start AND < end`.

## Untyped literals

An untyped literal passed to an overloaded function fails:

```
ERROR: function date_trunc(unknown, unknown) is not unique (42725)
```

Cast it to the column's type.

## Table size

```sql
SELECT relnamespace::regnamespace AS schema, relname,
       reltuples::bigint AS approx_rows,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relkind IN ('r', 'p')
  AND relname IN ('<table>', '<table>');
```

`approx_rows` of -1 means the table was never analyzed.

## Memory guard

Wrap a query that aggregates, joins or sorts a large table:

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15min';
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL hash_mem_multiplier = 1.0;
SET LOCAL jit = off;
SET LOCAL enable_memoize = off;

-- the query

ROLLBACK;
```

| Setting                               | Why                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `max_parallel_workers_per_gather = 0` | Each parallel worker claims its own `work_mem`, multiplying peak memory.                 |
| `hash_mem_multiplier = 1.0`           | PG15+ defaults to 2, doubling hash memory. A no-op on PG13 and PG14.                     |
| `jit = off`                           | Removes JIT compilation memory on large scans.                                           |
| `enable_memoize = off`                | Memoize sizes its cache from row estimates that can be badly wrong at scale. PG14+ only. |

Check the server version with `SELECT version();` before relying on a setting.
Use the guard only for large tables. It trades speed for a lower memory
ceiling. To see which settings the server already applies, read
`pg_settings`:

```sql
SELECT name, setting, source FROM pg_settings
WHERE name IN ('max_parallel_workers_per_gather', 'hash_mem_multiplier',
               'jit', 'enable_memoize', 'statement_timeout');
```

Some read-only tools reject `SET`. `set_config(name, value, true)` lasts only
for the current transaction, and such tools often run each statement in its
own transaction. Check that a setting holds before relying on it.

On a read replica, a long query can fail with "canceling statement due to
conflict with recovery". Narrow the window or split it by period, then retry.

## Query shape

- Qualify every column in a join, e.g. `f.user_id`, not `user_id`.
- When several conditions read the same large table without a selective index,
  one `GROUP BY` with `bool_or(...)` in `HAVING` reads it once. Compare against
  `EXISTS` with `EXPLAIN`.
- Generate the full set of periods with `generate_series` when every period
  must appear. Grouping existing rows drops periods with no activity.
- An aggregate with `GROUP BY` over no rows returns no rows, not 0. Drop the
  `GROUP BY` or start from the generated periods.
