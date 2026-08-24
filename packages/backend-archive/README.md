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

| Variable | Local value | Why |
|---|---|---|
| `S3_ACCESS_KEY` | `minio-username` | `.env-example` ships `...`, which MinIO rejects with `InvalidAccessKeyId`. |
| `S3_SECRET_KEY` | `minio-password` | Same. |
| `ARCHIVE_ENABLED` | `true` | Defaults to `false`, which exits at once and logs `archival.run.disabled`. |

Keep them in the `archival` 1Password environment, or pass them inline as below.

### 3. Run the archival script

```bash
S3_ACCESS_KEY=minio-username S3_SECRET_KEY=minio-password ARCHIVE_ENABLED=true \
  pnpm --filter backend-archive run archive:backfill-local
```

1Password asks for biometric approval before the script starts. `ARCHIVE_DRY_RUN` defaults to `true`, so the run writes to S3 and deletes nothing. Set `ARCHIVE_DRY_RUN=false` for a live, destructive run.

The script logs structured JSON to stdout. Key events to look for:

| Event                     | Meaning                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `archival.run.start`      | Startup — confirms `dryRun`, `retentionDays`, `batchSize`, etc.                  |
| `archival.batch.complete` | One batch processed — shows `batchArchived`, `batchSkipped`, `cursor`.           |
| `archival.flow.archived`  | All executions for a flow have been processed — lists IDs.                       |
| `archival.run.complete`   | Final summary — total `executions_archived`, `executions_skipped`, `durationMs`. |

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
pnpm --filter backend-archive run archive:rehydrate-local -- --flow-id <uuid>
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
pnpm --filter backend-archive run archive:rehydrate -- --flow-id <uuid>
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

> **Note:** only non-test-run executions (`test_run = false`) contribute to `stepCounts`. Test executions are archived and counted in `executionsArchived` but their steps are excluded from the breakdown.

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

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | no | `development` | Any value other than `development` skips the `.env-example` fallback and the dev defaults below. |
| `POSTGRES_HOST` / `RDS_PROXY_HOST` | yes (dev/prod) | — | Postgres writer host. `RDS_PROXY_HOST` takes precedence. |
| `POSTGRES_PORT` | no | `5432` | Postgres port. |
| `POSTGRES_DATABASE` | yes | `plumber_dev` (dev only) | Database name. |
| `POSTGRES_USERNAME` | yes | `postgres` (dev only) | Database user. |
| `POSTGRES_PASSWORD` | no | — | Database password. |
| `POSTGRES_ENABLE_SSL` | no | `false` | Set to `true` for SSL connections (required in prod). |
| `ARCHIVE_POSTGRES_READER_HOST` | **yes** | — | Postgres reader host for eligibility scans. Use `localhost` for local dev. |
| `S3_ENDPOINT` | yes (dev) | — | S3-compatible endpoint URL (MinIO in dev). Not required in AWS — uses IAM. |
| `S3_ACCESS_KEY` | yes (dev) | — | S3 access key (MinIO in dev). |
| `S3_SECRET_KEY` | yes (dev) | — | S3 secret key (MinIO in dev). |
| `ARCHIVE_BUCKET` | **yes** | — | S3 bucket name for archived objects. |
| `ARCHIVE_ENABLED` | no | `false` | Must be `true` for the archival script to do anything. |
| `ARCHIVE_DRY_RUN` | no | `false` | When `true`, writes to S3 but skips Postgres deletes. |
| `ARCHIVE_RETENTION_DAYS` | no | `365` | Executions older than this are eligible for archival. |
| `ARCHIVE_BATCH_SIZE` | no | `500` | Executions fetched per batch. |
| `ARCHIVE_BATCH_SLEEP_MS` | no | `2000` | Sleep between batches to reduce DB load. |
| `ARCHIVE_INTRA_BATCH_CONCURRENCY` | no | `10` | Concurrent S3 uploads within a batch. |
| `ARCHIVE_MAX_RUNTIME_MS` | **yes** | — | Wall-clock limit for a single run (ms). Set to `0` to disable. |
| `ARCHIVE_DELETED_FLOWS_ONLY` | no | `false` | Restrict archival to executions belonging to soft-deleted flows. |
| `ARCHIVE_TEST_RUNS` | no | `false` | When `ARCHIVE_DELETED_FLOWS_ONLY=true`, also archive test executions on active flows. Has no effect when `ARCHIVE_DELETED_FLOWS_ONLY=false`. |

---

## Running tests

```bash
pnpm --filter backend-archive run test:unit
```

---

## Production deployment

The archival task runs as a scheduled ECS Fargate task built from `Dockerfile.archival`. The task definition template is at [`ecs/archival-task-definition.json`](../../ecs/archival-task-definition.json). All secrets are sourced from AWS Secrets Manager — no plaintext values in the task definition.

The task's IAM role provides S3 credentials, so `S3_ACCESS_KEY` and `S3_SECRET_KEY` are not needed. The scheduled task calls the compiled entrypoint directly and never touches the npm scripts above.
