# Test data (fixtures)

How to check that a query returns the right rows, not just that it compiles. Insert test rows into the
local Postgres container, run the query, then roll back. Nothing persists, so the human's dev data
stays clean and there is nothing to clean up.

## Rules

- Put everything in one SQL file: `BEGIN`, the inserts, the query, `ROLLBACK`, then the leftover
  check. Keep it in the scratchpad, not the repo.
- Never `COMMIT`. Never write through anything except the local `psql` connection from
  [SKILL.md](../SKILL.md) step 5.
- Paste only the query statement into the template. Strip any `BEGIN`, `COMMIT` or `ROLLBACK` from
  it, e.g. the OOM-guard wrapper from [gotchas.md](gotchas.md) §5. A nested `BEGIN` only warns, so
  its `COMMIT` saves the test rows. Put any `SET LOCAL` lines right after the template's `BEGIN`.
- Run with `-v ON_ERROR_STOP=1`. On an error, `psql` exits and the open transaction rolls back.
- Insert with fixed UUIDs, so later inserts can reference earlier rows. Use a prefix no real row
  has, e.g. `f1f1f1f1-0000-4000-8000-…`.
- Use the `example.test` domain for `users.email`. `email` is unique.
- Run the query as its own statement after the inserts. A data-modifying CTE's rows are invisible
  to the rest of its own statement.
- Set `created_at` explicitly whenever the query has a time window. Include one row just outside it.

## Asserting results

The dev database already has rows, and the query sees them too. An expected count can match by
counting an existing row while missing a test row.

- For a query that returns one row per item, assert which test IDs appear and which do not.
- For an aggregate, run the query before and after the inserts, in the same transaction. Assert the
  difference.
- After `ROLLBACK`, assert that no row with the test prefix is left. A non-zero count means
  something committed. Tell the human.

## Required columns

Only three columns on the core tables are `NOT NULL` without a default: `users.email`,
`steps.type` and `steps.position`. Every foreign key is nullable, but set them anyway, or joins
drop the rows. Check `\d <table>` if a migration has changed this.

## Running it

```bash
PGPASSWORD=<password> psql -h localhost -p <port> -U <user> -d <database> \
  -v ON_ERROR_STOP=1 -x -f <scratchpad>/fixture-test.sql
```

`-x` prints one column per line, which is easier to compare against the expected result.

## Template

The insert chain runs from users to flows, steps, executions, then execution_steps. This example
checks a query for FormSG submissions whose NRIC filter failed. The query must read the filter used
by each run from the trigger run's `data_in`, not the step's current setting.

- Flow `…0101` must appear. Its run had masking on but stored a raw NRIC. Its current setting is
  `none`, which catches a query that reads the current setting.
- Flow `…0102` must not appear. Its run stored a masked NRIC.
- Flow `…0103` must not appear. Its run had masking off. Its current setting is `mask`.
- The July run of `…0101` is outside the window.

```sql
BEGIN;
-- SET LOCAL lines, if the query needs any, go here.

INSERT INTO users (id, email) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000001', 'fixture-1@example.test');

INSERT INTO flows (id, user_id, name) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000101', 'f1f1f1f1-0000-4000-8000-000000000001', 'fixture: should count'),
  ('f1f1f1f1-0000-4000-8000-000000000102', 'f1f1f1f1-0000-4000-8000-000000000001', 'fixture: masked'),
  ('f1f1f1f1-0000-4000-8000-000000000103', 'f1f1f1f1-0000-4000-8000-000000000001', 'fixture: filter off at run time');

INSERT INTO steps (id, flow_id, type, position, app_key, key, parameters) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000201', 'f1f1f1f1-0000-4000-8000-000000000101', 'trigger', 1, 'formsg', 'newSubmission', '{"nricFilter": "none"}'),
  ('f1f1f1f1-0000-4000-8000-000000000202', 'f1f1f1f1-0000-4000-8000-000000000101', 'action', 2, 'postman', 'sendTransactionalEmail', '{"body": "{{step.f1f1f1f1-0000-4000-8000-000000000201.verifiedSubmitterInfo.uinFin}}"}'),
  ('f1f1f1f1-0000-4000-8000-000000000203', 'f1f1f1f1-0000-4000-8000-000000000102', 'trigger', 1, 'formsg', 'newSubmission', '{"nricFilter": "mask"}'),
  ('f1f1f1f1-0000-4000-8000-000000000204', 'f1f1f1f1-0000-4000-8000-000000000103', 'trigger', 1, 'formsg', 'newSubmission', '{"nricFilter": "mask"}');

INSERT INTO executions (id, flow_id, test_run, created_at) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000101', false, '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000302', 'f1f1f1f1-0000-4000-8000-000000000102', false, '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000303', 'f1f1f1f1-0000-4000-8000-000000000101', false, '2026-07-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000304', 'f1f1f1f1-0000-4000-8000-000000000103', false, '2026-09-15 10:00+08');

INSERT INTO execution_steps (execution_id, step_id, app_key, key, status, data_in, data_out, created_at) VALUES
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000201', 'formsg', 'newSubmission', 'success', '{"nricFilter": "mask"}', '{"verifiedSubmitterInfo": {"uinFin": "S1234567A"}}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000301', 'f1f1f1f1-0000-4000-8000-000000000202', 'postman', 'sendTransactionalEmail', 'success', '{"body": "S1234567A"}', '{}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000302', 'f1f1f1f1-0000-4000-8000-000000000203', 'formsg', 'newSubmission', 'success', '{"nricFilter": "mask"}', '{"verifiedSubmitterInfo": {"uinFin": "xxxxx567A"}}', '2026-09-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000303', 'f1f1f1f1-0000-4000-8000-000000000201', 'formsg', 'newSubmission', 'success', '{"nricFilter": "mask"}', '{"verifiedSubmitterInfo": {"uinFin": "T7654321Z"}}', '2026-07-15 10:00+08'),
  ('f1f1f1f1-0000-4000-8000-000000000304', 'f1f1f1f1-0000-4000-8000-000000000204', 'formsg', 'newSubmission', 'success', '{"nricFilter": "none"}', '{"verifiedSubmitterInfo": {"uinFin": "S7654321B"}}', '2026-09-15 10:00+08');

-- Expected: flow ...0101 with 1 execution. Flows ...0102 and ...0103 absent.
<query under test, with no BEGIN/COMMIT/ROLLBACK>;

ROLLBACK;

-- Expected: 0.
SELECT count(*) AS leftover_test_users FROM users WHERE id::text LIKE 'f1f1f1f1-%';
```

## Columns that need care

- `steps.parameters` holds the step's current settings, with `{{step.<stepId>.<path>}}` variables.
- `execution_steps.data_in` holds the settings a run used. For an action, variables are filled in.
  For a trigger or an MRF step, it is a copy of `steps.parameters` at run time. A query about a past
  run's settings reads this column, not `steps.parameters`.
- `execution_steps.data_out` holds the step's output. Later steps read variables from it.
- `executions.test_run` and every `deleted_at` change which rows a query counts. Add a row for each
  one the query filters on.
