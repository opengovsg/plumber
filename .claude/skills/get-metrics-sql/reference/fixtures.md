# Test data (fixtures)

How to check that a query returns the right rows, not just that it compiles. Insert test rows into the
local Postgres container, run the query, then roll back. Nothing persists, so the human's dev data
stays clean and there is nothing to clean up.

## Rules

- Put everything in one SQL file: `BEGIN`, the inserts, the query, `ROLLBACK`. Keep it in the
  scratchpad, not the repo.
- Never `COMMIT`. Never send writes through anything except `docker exec` on the local container.
- Run with `-v ON_ERROR_STOP=1`. On an error, `psql` exits and the open transaction rolls back.
- Insert with fixed UUIDs, so later inserts can reference earlier rows. Use a prefix no real row
  has, e.g. `f1f1f1f1-0000-4000-8000-…`.
- Use the `example.test` domain for `users.email`. `email` is unique.
- Run the query as its own statement after the inserts. A data-modifying CTE's rows are invisible
  to the rest of its own statement.
- Set `created_at` explicitly whenever the query has a time window. Include one row just outside it.

## Required columns

Only three columns on the core tables are `NOT NULL` without a default: `users.email`,
`steps.type` and `steps.position`. Every foreign key is nullable, but set them anyway, or joins
drop the rows. Check `\d <table>` if a migration has changed this.

## Running it

```bash
docker exec -i <postgres container name> psql -U <user> -d <database> \
  -v ON_ERROR_STOP=1 -x < <scratchpad>/fixture-test.sql
```

`-i` passes the file on stdin. `-x` prints one column per line, which is easier to compare against
the expected result.

## Template

The insert chain runs from users to flows, steps, executions, then execution_steps. This example
checks a query for FormSG submissions whose NRIC filter failed. It has one row the query must count,
one it must skip, and one outside the time window.

```sql
BEGIN;

INSERT INTO users (id, email) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000001', 'fixture-1@example.test');

INSERT INTO flows (id, user_id, name) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000101', 'f1f1f1f1-0000-4000-8000-000000000001', 'fixture: should count'),
  ('f1f1f1f1-0000-4000-8000-000000000102', 'f1f1f1f1-0000-4000-8000-000000000001', 'fixture: should skip');

INSERT INTO steps (id, flow_id, type, position, app_key, key, parameters) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000201', 'f1f1f1f1-0000-4000-8000-000000000101', 'trigger', 1, 'formsg', 'newSubmission', '{"nricFilter": "mask"}'),
  ('f1f1f1f1-0000-4000-8000-000000000202', 'f1f1f1f1-0000-4000-8000-000000000101', 'action', 2, 'postman', 'sendTransactionalEmail', '{"body": "{{step.f1f1f1f1-0000-4000-8000-000000000201.verifiedSubmitterInfo.uinFin}}"}'),
  ('f1f1f1f1-0000-4000-8000-000000000203', 'f1f1f1f1-0000-4000-8000-000000000102', 'trigger', 1, 'formsg', 'newSubmission', '{"nricFilter": "mask"}');

INSERT INTO executions (id, flow_id, test_run, created_at) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000101', false, '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000302', 'f1f1f1f1-0000-4000-8000-000000000102', false, '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000303', 'f1f1f1f1-0000-4000-8000-000000000101', false, '2026-07-15 10:00+08');

INSERT INTO execution_steps (execution_id, step_id, app_key, key, status, data_in, data_out, created_at) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000201', 'formsg', 'newSubmission', 'success', '{}', '{"verifiedSubmitterInfo": {"uinFin": "S1234567A"}}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000202', 'postman', 'sendTransactionalEmail', 'success', '{"body": "S1234567A"}', '{}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000302', 'f1f1f1f1-0000-4000-8000-000000000203', 'formsg', 'newSubmission', 'success', '{}', '{"verifiedSubmitterInfo": {"uinFin": "xxxxx567A"}}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000303', 'f1f1f1f1-0000-4000-8000-000000000201', 'formsg', 'newSubmission', 'success', '{}', '{"verifiedSubmitterInfo": {"uinFin": "T7654321Z"}}', '2026-07-15 10:00+08');

-- Expected: 1 row, flow ...0101, 1 execution (the July one is outside the window).
<query under test>;

ROLLBACK;
```

## Columns that need care

- `steps.parameters` holds the step's settings as written, with `{{step.<stepId>.<path>}}` variables.
- `execution_steps.data_in` holds the parameters after variables are filled in. For a trigger or an
  MRF step, it is the unfilled `steps.parameters`.
- `execution_steps.data_out` holds the step's output. Later steps read variables from it.
- `executions.test_run` and every `deleted_at` change which rows a query counts. Add a row for each
  one the query filters on.
