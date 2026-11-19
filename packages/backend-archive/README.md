# backend-archive

Standalone ECS task that archives old Plumber execution records from Postgres to S3, and a CLI tool for rehydrating (restoring) archived executions back into Postgres.

## Overview

The archival pipeline runs nightly as a Fargate task. It:

1. **Scans** Postgres for eligible executions (deleted flows, aged-out non-test executions, aged-out test executions — depending on config flags).
2. **Serialises** each execution + its steps into a gzip-compressed JSON object and writes it to S3.
3. **Verifies** the S3 object is present and non-empty.
4. **Deletes** the rows from `execution_steps` and `executions` in a single transaction (skipped in dry-run mode).

S3 key format:

```
executions/flow_id=<uuid>/year=YYYY/month=MM/execution_id=<uuid>.json.gz
test-executions/flow_id=<uuid>/year=YYYY/month=MM/execution_id=<uuid>.json.gz
```

Rehydration (`rehydrate-execution`) runs on demand (not scheduled). It reads archived objects from S3 and writes execution + step rows back into Postgres, setting an `archiveDisabled` guard on the flow to prevent the archival task from immediately re-archiving them.

---

## Running archival locally

### 1. Prerequisites

Start the dev stack (Postgres + MinIO) from the repo root if it isn't already running:

```bash
pnpm run setup
```

This also creates the `plumber-development-archive-bucket` MinIO bucket used below.

The `-local` archive commands run through `scripts/with-op-env.mjs`, so you also need the 1Password desktop app unlocked and an `op-dev.json` holding an `archival` environment id. The [root README](../../README.md) covers that one-time setup.

### 2. Supply the environment

There is no `.env` file. Variables come from three places, in descending priority:

1. Shell exports, for one-off overrides.
2. The `archival` 1Password environment, which the loader fetches at spawn time and injects into the process. The `-local` scripts only.
3. [`.env-example`](.env-example), which `config.ts` loads at runtime for any key still unset. It loads only while `APP_ENV=development`.

Those placeholders already point at the dev Docker stack, so a local run needs three overrides:

| Variable          | Local value      | Why                                                                        |
| ----------------- | ---------------- | -------------------------------------------------------------------------- |
| `S3_ACCESS_KEY`   | `minio-username` | `.env-example` ships `...`, which MinIO rejects with `InvalidAccessKeyId`. |
| `S3_SECRET_KEY`   | `minio-password` | Same.                                                                      |
| `ARCHIVE_ENABLED` | `true`           | Defaults to `false`, which exits at once and logs `archival.run.disabled`. |

Keep them in the `archival` 1Password environment, or pass them inline as below.

### 3. Run the archival script

```bash
S3_ACCESS_KEY=minio-username S3_SECRET_KEY=minio-password ARCHIVE_ENABLED=true \
  pnpm --filter backend-archive run archive:backfill-local
```

1Password asks for biometric approval before the script starts. `ARCHIVE_DRY_RUN` defaults to `true`, so the run writes to S3 and deletes nothing. Set `ARCHIVE_DRY_RUN=false` for a live, destructive run.

The script logs structured JSON to stdout. Key events to look for:

| Event                              | Meaning                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `archival.run.start`               | Startup — confirms `dryRun`, `retentionDays`, `batchSize`, etc.                                                                                  |
| `archival.batch.complete`          | One batch processed — shows `batchArchived`, `batchSkipped`, `cursor`.                                                                           |
| `archival.flow.archived`           | All executions for a flow have been processed — shows `executionsCount`, `testExecutionsCount`. Individual IDs are in the S3 keys.               |
| `archival.run.complete`            | Final summary — `executions_archived` (real + test), `real_executions_archived`, `test_executions_archived`, `executions_skipped`, `durationMs`. |
| `archival.run.meta_write_failed`   | The `_meta/runs` write failed after archiving. Carries the same counts as `run.complete`.                                                        |
| `archival.execution.error`         | One execution failed to archive. Carries `executionId`. The row stays in Postgres and the next run retries it.                                   |
| `archival.execution.verify_failed` | The S3 check after upload failed. Carries `executionId`, `key` and `reason`. The row stays in Postgres and the next run retries it.              |

### 4. Verify S3 contents

```bash
# List all archived executions for a flow
mc ls --recursive local/plumber-development-archive-bucket/executions/flow_id=<your-flow-id>/

# Inspect one object's metadata
mc stat "local/plumber-development-archive-bucket/executions/flow_id=<uuid>/year=YYYY/month=MM/execution_id=<uuid>.json.gz"

# Inspect the payload
mc cat "local/plumber-development-archive-bucket/executions/flow_id=<uuid>/year=YYYY/month=MM/execution_id=<uuid>.json.gz" \
  | gunzip | jq .
```

---

## Running against a production target

Both the archival and the rehydration script can point at a **live** Postgres and S3 bucket. Run them from a machine with network access to both.

**Set `APP_ENV` to any value other than `development`.** That stops `.env-example` from loading and drops `config.ts`'s dev defaults, so a variable you forget throws instead of quietly reaching a local `plumber_dev`.

**Set `ARCHIVE_DRY_RUN` explicitly for a backfill.** With those placeholders gone it falls back to `false`, and the run deletes rows from the target.

### From your own machine

Repoint `op-dev.json`'s `archival` entry at a 1Password environment holding the target's variables, `APP_ENV` included. Then use the `-local` scripts:

```bash
pnpm --filter backend-archive run archive:rehydrate-local --flow-id <uuid>
pnpm --filter backend-archive run archive:backfill-local
```

The loader injects that environment into the process and writes nothing to disk. Shell exports still outrank it, so you can override a single key inline.

### From a bastion host or an ECS task

1Password does not run there. Export the variables yourself and use the unsuffixed scripts, which take the shell as-is:

```bash
export APP_ENV=production
export POSTGRES_HOST=<rds-writer-endpoint>
export POSTGRES_PORT=5432
export POSTGRES_DATABASE=<db-name>
export POSTGRES_USERNAME=<db-user>
export POSTGRES_PASSWORD=<db-password>
export POSTGRES_ENABLE_SSL=true

export ARCHIVE_POSTGRES_READER_HOST=<rds-reader-endpoint>

# S3 — IAM role credentials are used automatically in AWS environments.
# Only set these if running from a machine without instance credentials.
# export S3_ACCESS_KEY=...
# export S3_SECRET_KEY=...

export ARCHIVE_BUCKET=<prod-or-staging-bucket-name>

# Backfill only. It exits at once without ARCHIVE_ENABLED.
export ARCHIVE_ENABLED=true
export ARCHIVE_DRY_RUN=true
```

Then run:

```bash
pnpm --filter backend-archive run archive:rehydrate --flow-id <uuid>
pnpm --filter backend-archive run archive:backfill
```

Both call `ts-node`, a devDependency, so the host needs a full checkout and an install that kept devDependencies. The `Dockerfile.archival` image has neither. Inside that image, call the compiled entrypoint from `/opt/plumber`:

```bash
node packages/backend-archive/dist/scripts/rehydrate-execution.js --flow-id <uuid>
```

### Rehydration subcommands

| Goal                                                 | Command                                               |
| ---------------------------------------------------- | ----------------------------------------------------- |
| List all archived execution IDs for a flow           | `-- --flow-id <uuid>`                                 |
| Inspect a single archived execution (JSON to stdout) | `-- --flow-id <uuid> --execution-id <uuid>`           |
| Restore all executions for a flow to Postgres        | `-- --flow-id <uuid> --restore`                       |
| Restore a single execution to Postgres               | `-- --flow-id <uuid> --execution-id <uuid> --restore` |

### What `--restore` does

1. Sets `archiveDisabled: true` in the flow's `config` JSONB — prevents the nightly archival job from immediately re-archiving the restored rows.
2. Inserts the execution row (`ON CONFLICT DO NOTHING` — idempotent).
3. Inserts all step rows (`ON CONFLICT DO NOTHING` — idempotent).
4. Prints a JSON line per execution: `{ executionId, executionInserted, stepsInserted }`.

**After you are done with the restored data**, clear the re-archival guard:

```sql
UPDATE flows SET config = config - 'archiveDisabled' WHERE id = '<flow-id>';
```

---

## Exporting analytics tables

The archival task writes the silver analytics tables to S3 each night, before it archives. The export code lives in [`backend-analytics`](../backend-analytics/README.md). This package runs it. It writes only when `APP_ENV` is `prod` or `staging`. Each environment has its own bucket, and PostHog reads a bucket only if someone attaches it. Each table becomes one Parquet file at `silver/<table>/current.parquet`, except `flow_step`. `flow_step` writes one file per Singapore day at `silver/flow_step/day=YYYY-MM-DD.parquet`, holding only the steps whose `updated_at` falls on that day. PostHog bills each row it imports, so a nightly full copy would bill every step daily. The first run writes a full copy. A full copy spans `day=YYYY-MM-DD.part-N.parquet` files of 50,000 steps plus the unnumbered file. [Tracking finished days](#tracking-finished-days) covers missed nights. Every row carries the file's `day`. A step's current state is its row with the latest `day`, then the latest `updated_at`.

A day file holds each changed step as it was at export time, not at the end of that day. So:

- A missed night in the last 7 days is redone on the next run, but only to each step's current state. A step edited on both missed days appears once, on the later day. An older gap alerts and needs `--full`.
- Edits between exports are not kept in `flow_step`. The bronze mutation log keeps each `updateStep` call's app, action and resource, but not its other parameters.
- `--full` writes only yesterday, and its completion file covers every earlier day. The full copy holds every step's current state, so nothing is lost beyond the point above.
- A finished day is never rewritten. A rerun reads each step's current `updated_at`, so it would drop steps edited since.
- Approving a transfer rewrites the pipe's steps. Shared connections point at duplicated copies, and M365 Excel steps lose their connection. Those steps appear in that day's file with their new `connection_id`.

Bump `flowStepTable.version` when its columns or query change, or when an existing catalog `resource_parameter` changes. The next night writes a full copy instead of a day file. That syncs every step to PostHog once, about 705k rows, so batch such changes.

Columns read from `steps.config`, none of which holds user content:

- `ai_tools`: the AI builder tools recorded on the step, sorted and comma-joined, such as `create_step,update_step_parameters`. It stays raw, so a new tool needs no re-export. Views decide what counts as created or edited by AI.
- `has_setup_guide`: true while the step still shows the setup guide from a template or the AI builder. The guide is cleared when the step is first tested. The pipe's template is `flow_stage.template_id`.
- `has_step_name`: whether the user named the step. The name is not exported.
- `if_then_end_step_id`: on an if-then step, the last step of its block.
- `approval_reject_step_id`: on a step in an MRF approval step's reject path, that approval step.
- `parameters_version`: the stored parameter format. Analytics reads `parameters` as stored, before the app's step transformer runs.

Known gaps, accepted because each is rare:

- **Direct writes.** `--full` rewrites a day PostHog may already have imported. A step changed by a direct write then has two rows with the same `day` and `updated_at`, and the view may pick the older one.
- **Late writes.** The export runs at 01:00 Singapore time and reads the day before. A write stamped before midnight that becomes readable only after the export read it is never exported. That needs a transaction open past 01:00, an hour of Aurora reader lag, or an app clock an hour slow. The step then keeps its earlier state in PostHog, for example still active after a soft delete, until it changes again or `--full` runs.

`analytics:export` runs the same code by hand. It reads through the reader endpoint, `ARCHIVE_POSTGRES_READER_HOST`.

| Flag           | Meaning                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--tables a,b` | Silver tables to write. Default: all. Today: `flow_transfer`, `dim_user`, `flow_stage`, `flow_access`, `flow_ai_suggestion`, `action_catalog`, `flow_step`. |
| `--full`       | Write `flow_step` as a full copy for yesterday. Run it after a migration or script writes `steps` directly, since those skip `updated_at`.                  |
| `--out <dir>`  | Write the files under a local folder, at the same keys as S3. Runs in any `APP_ENV`.                                                                        |
| `--s3`         | Write to `ANALYTICS_BUCKET`, exactly as the nightly job does. Runs only when `APP_ENV` is `prod` or `staging`.                                              |

Pass exactly one of `--out` and `--s3`.

To export production data to your own machine, point the `archival` 1Password environment at production, as in [From your own machine](#from-your-own-machine). Then:

```bash
pnpm --filter backend-archive run analytics:export-local --tables flow_transfer,dim_user --out ./analytics-out
```

`dim_user` holds email addresses. Keep the folder on your machine and delete it after the upload. Check a file with DuckDB:

```bash
duckdb -c "DESCRIBE SELECT * FROM read_parquet('analytics-out/silver/dim_user/current.parquet')"
```

## Extracting the mutation log

The archival task also extracts yesterday's GraphQL mutations from the server request log, after the silver tables. It runs a CloudWatch Logs Insights query on `ANALYTICS_REQUEST_LOG_GROUP` and writes one Parquet file per Singapore day to `bronze/mutation_log/day=YYYY-MM-DD/current.parquet`. A rerun of a day overwrites that day's file. The latest day file is the watermark: each night writes every missing day after it, through yesterday, so a failed night is retried. It catches up at most 7 days and logs `analytics.mutation_log.catch_up_capped` for older gaps, which need `analytics:mutation-log --from --to`. It writes only when `APP_ENV` is `prod` or `staging`.

Each row holds `ts`, `user_id`, `operation`, `flow_id`, `step_id`, `table_id`, `connection_id`, `app_key`, `action_key`, `resource_id` and `http_status`. `operation` is the mutation's root field, such as `updateFlow`. `app_key`, `action_key` and `resource_id` are set for `updateStep` only, from the call's `appKey`, `key` and the parameter the action catalog names in `resource_parameter`. A templated resource is null. No other variable is kept, since step parameters can hold user content.

Each row records a request, not its outcome. GraphQL returns resolver errors with HTTP 200, so a rejected `updateStep` looks like a saved one. Treat `app_key`, `action_key` and `resource_id` as attempted changes, and read saved state from `flow_step`. A mutation whose root selection is a fragment spread gets no `operation`. Plumber's frontend never sends one. The editor's `deleteStep` sends only step ids, so a row with a `step_id` and no `flow_id` gets its pipe from `steps.flow_id` through the database reader, deleted steps included. The day's `rowsWithFlowFromStep` counts them. Morgan logs variables with every `"` turned into `'`, so an apostrophe directly before `,` `:` `}` or `]` makes them unparseable. The ids are then recovered from their fixed place in the editor's `updateStep` input, other ids and `resource_id` stay null, and the day's `rowsWithUnreadableVariables` counts those rows. Lines logged before the request log carried a user id have no `user_id`.

`analytics:mutation-log` runs the same code for a range of days, for example to extract history:

| Flag                 | Meaning                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--from YYYY-MM-DD`  | First Singapore day.                                                                                                                                                                                                                                                                  |
| `--to YYYY-MM-DD`    | Last Singapore day, inclusive. Default: `--from`.                                                                                                                                                                                                                                     |
| `--log-group <name>` | Server log group, with `--out` only. Default: `ANALYTICS_REQUEST_LOG_GROUP`.                                                                                                                                                                                                          |
| `--out <dir>`        | Write the files under a local folder, at the same keys as S3. Runs in any `APP_ENV`.                                                                                                                                                                                                  |
| `--s3`               | Write to `ANALYTICS_BUCKET`, exactly as the nightly job does. Runs only when `APP_ENV` is `prod` or `staging`. Finished days only, since the nightly run treats the latest day file as complete. Reads `ANALYTICS_REQUEST_LOG_GROUP`, so the source matches the bucket's environment. |

The query reads AWS credentials from the default chain. To try one day against production from your own machine:

```bash
pnpm --filter backend-archive run analytics:mutation-log-local --from 2026-11-05 --log-group plumber-prod/ecs/application-server --out ./mutation-log-out
```

Logs Insights bills about $0.0076 per GB scanned. One day of the server log is about 0.4 GB.

---

## Tracking finished days

An export written as one file set per Singapore day marks each finished day with a completion file. The code lives in `backend-analytics/src/day-completion.ts`.

- The file sits at `bronze/_completion/<job>/day=YYYY-MM-DD.v<version>.json`. A full copy adds `.full` before `.json`. It sits under `bronze/` because the archival role writes only `bronze/` and `silver/`, and PostHog reads only `silver/`.
- It is written after all of the day's files, so a failed run leaves the day unmarked. Its body lists those files and whether the nightly run or a manual command wrote it.
- Each night redoes every day in the last 7, through yesterday, with no completion file at the job's current version.
- A day that fails does not hold back later days. It stays unmarked for the next run, logs `analytics.export.day.error`, and the run still fails.
- The first run writes `bronze/_completion/<job>/start=YYYY-MM-DD.json` before it starts. Days before that marker and the first completion file are history, so the first night after release never rewrites history. A first run that fails is still owed. A full copy covers every earlier day.
- Each run logs `analytics.export.coverage` per job, even when the export fails: `missingDays` in the last 30 days, `firstMissing`, `lastMissing` and `staleDays`. `staleDays` includes a full copy from an older version. A Datadog monitor alerts when `missingDays` is above zero. When the completion files cannot be listed, the run logs `analytics.export.coverage.unavailable` instead.

## Counting archived steps by app and action

Each archival run writes a summary object to `_meta/runs/{runAt}.json` in the bucket. The `stepCounts` field breaks down the number of archived steps by SGT date → `appKey` → `actionKey` for that run.

### Single run (local / MinIO)

```bash
# Find the runAt timestamp in the startup log (archival.run.start → "runAt" field), then:
mc cat "local/plumber-development-archive-bucket/_meta/runs/<runAt>.json" | jq '.stepCounts'
```

Output shape:

```json
{
  "2026-07-27": {
    "formsg": { "submitForm": 42 },
    "slack":  { "sendMessage": 17, "findMessage": 3 }
  },
  ...
}
```

Dates are keyed by the step's `created_at`, converted to SGT (not the archival run date) — a single run can span many historical dates since it works through a backlog of eligible executions.

`nullStepCount` in the same object captures steps where `appKey` or `key` could not be resolved (pre-denormalisation rows).

> **Note:** only non-test-run executions (`test_run = false`) contribute to `stepCounts`. Test executions are archived but their steps are excluded from the breakdown.

`executionsArchived` counts real and test executions. `realExecutionsArchived` and `testExecutionsArchived` split it by `test_run`.

### Aggregate across all runs (local)

To get cumulative counts by date across every run stored in the bucket, download all meta files and sum them. Because the same date can appear in multiple run files (old backlog dates get touched across several runs), group by date + app + action rather than assuming one date lives in one file:

```bash
mc ls local/plumber-development-archive-bucket/_meta/runs/ \
  | awk '{print $NF}' \
  | while read -r f; do
      mc cat "local/plumber-development-archive-bucket/_meta/runs/$f"
    done \
  | jq -s '
      [ .[] | select(.dryRun == false) | .stepCounts | to_entries[] |
        .key as $date | .value | to_entries[] |
        .key as $app | .value | to_entries[] |
        { date: $date, app: $app, action: .key, count: .value } ]
      | group_by(.date + "." + .app + "." + .action)[]
      | { date: .[0].date, app: .[0].app, action: .[0].action, count: ([.[].count] | add) }
    ' \
  | jq -s 'sort_by(.date, -.count)'
```

The `select(.dryRun == false)` filter excludes dry-run files, which would double-count executions that were never actually deleted.

### Aggregate across all runs (production S3)

```bash
aws s3 ls s3://<bucket>/_meta/runs/ \
  | awk '{print $NF}' \
  | while read -r f; do
      aws s3 cp "s3://<bucket>/_meta/runs/$f" - 2>/dev/null
    done \
  | jq -s '
      [ .[] | select(.dryRun == false) | .stepCounts | to_entries[] |
        .key as $date | .value | to_entries[] |
        .key as $app | .value | to_entries[] |
        { date: $date, app: $app, action: .key, count: .value } ]
      | group_by(.date + "." + .app + "." + .action)[]
      | { date: .[0].date, app: .[0].app, action: .[0].action, count: ([.[].count] | add) }
    ' \
  | jq -s 'sort_by(.date, -.count)'
```

---

## Configuration reference

| Variable                           | Required       | Default                  | Description                                                                                                                                  |
| ---------------------------------- | -------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                          | no             | `development`            | Any value other than `development` skips the `.env-example` fallback and the dev defaults below.                                             |
| `POSTGRES_HOST` / `RDS_PROXY_HOST` | yes (dev/prod) | —                        | Postgres writer host. `RDS_PROXY_HOST` takes precedence.                                                                                     |
| `POSTGRES_PORT`                    | no             | `5432`                   | Postgres port.                                                                                                                               |
| `POSTGRES_DATABASE`                | yes            | `plumber_dev` (dev only) | Database name.                                                                                                                               |
| `POSTGRES_USERNAME`                | yes            | `postgres` (dev only)    | Database user.                                                                                                                               |
| `POSTGRES_PASSWORD`                | no             | —                        | Database password.                                                                                                                           |
| `POSTGRES_ENABLE_SSL`              | no             | `false`                  | Set to `true` for SSL connections (required in prod).                                                                                        |
| `ARCHIVE_POSTGRES_READER_HOST`     | **yes**        | —                        | Postgres reader host for eligibility scans. Use `localhost` for local dev.                                                                   |
| `S3_ENDPOINT`                      | yes (dev)      | —                        | S3-compatible endpoint URL (MinIO in dev). Not required in AWS — uses IAM.                                                                   |
| `S3_ACCESS_KEY`                    | yes (dev)      | —                        | S3 access key (MinIO in dev).                                                                                                                |
| `S3_SECRET_KEY`                    | yes (dev)      | —                        | S3 secret key (MinIO in dev).                                                                                                                |
| `ARCHIVE_BUCKET`                   | **yes**        | —                        | S3 bucket name for archived objects.                                                                                                         |
| `ARCHIVE_ENABLED`                  | no             | `false`                  | Must be `true` for the archival script to do anything.                                                                                       |
| `ARCHIVE_DRY_RUN`                  | no             | `false`                  | When `true`, writes to S3 but skips Postgres deletes.                                                                                        |
| `ARCHIVE_RETENTION_DAYS`           | no             | `365`                    | Executions older than this are eligible for archival.                                                                                        |
| `ARCHIVE_BATCH_SIZE`               | no             | `500`                    | Executions fetched per batch.                                                                                                                |
| `ARCHIVE_BATCH_SLEEP_MS`           | no             | `2000`                   | Sleep between batches to reduce DB load.                                                                                                     |
| `ARCHIVE_INTRA_BATCH_CONCURRENCY`  | no             | `10`                     | Concurrent S3 uploads within a batch.                                                                                                        |
| `ARCHIVE_MAX_RUNTIME_MS`           | **yes**        | —                        | Wall-clock limit for a single run (ms). Set to `0` to disable.                                                                               |
| `ARCHIVE_DELETED_FLOWS_ONLY`       | no             | `false`                  | Restrict archival to executions belonging to soft-deleted flows.                                                                             |
| `ARCHIVE_TEST_RUNS`                | no             | `false`                  | When `ARCHIVE_DELETED_FLOWS_ONLY=true`, also archive test executions on active flows. Has no effect when `ARCHIVE_DELETED_FLOWS_ONLY=false`. |
| `ANALYTICS_BUCKET`                 | yes (prod)     | —                        | S3 bucket for the analytics `bronze/` and `silver/` files.                                                                                   |
| `ANALYTICS_REQUEST_LOG_GROUP`      | yes (prod)     | —                        | Server log group the mutation log is extracted from.                                                                                         |

---

## Running tests

```bash
pnpm --filter backend-archive run test:unit
```

The analytics export tests live in [`backend-analytics`](../backend-analytics/README.md#running-tests).

---

## Production deployment

The archival task runs as a scheduled ECS Fargate task built from `Dockerfile.archival`. The task definition template is at [`ecs/archival-task-definition.json`](../../ecs/archival-task-definition.json). All secrets are sourced from AWS Secrets Manager — no plaintext values in the task definition.

The task's IAM role provides S3 credentials, so `S3_ACCESS_KEY` and `S3_SECRET_KEY` are not needed. The scheduled task calls the compiled entrypoint directly and never touches the pnpm scripts above.
