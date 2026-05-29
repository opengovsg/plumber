# BullMQ Pro batching for m365-excel — PR A (batch queue + routing + batch worker stub + metric)

**Status:** In progress
**Created:** 2026-05-29
**Last updated:** 2026-05-29

## Resume from here

Phases 1 & 2 done (combined into one PR per user). Phase 1: added `batch?` to `IAppQueue` in `packages/types/index.d.ts` (size/minSize/timeout/groupAffinity/actionKeys/getGroupConfigForJob) and `M365_EXCEL_BATCH_ENABLED` (default false) + `M365_EXCEL_BATCH_SIZE` (=20, validated) to `packages/backend/src/config/app-env-vars/m365.ts`. Phase 2: added the flag-gated `batch` block to `packages/backend/src/apps/m365-excel/queue/index.ts` (actionKeys `['createTableRow']`, group key `${fileId}-${tableId}-${step.key}` via a new `getBatchGroupConfigForJob` that validates fileId+tableId, `size = M365_EXCEL_BATCH_SIZE`, `groupAffinity: true`). Existing config untouched; flag-off ⇒ `batch` undefined. Backend typecheck clean both phases. **Next: Phase 3** — register `{app-actions-${appKey}-batch}` queue + enqueue routing in `packages/backend/src/queues/action.ts` (this is where the scaled batch rate limit `max: size, duration: size × interval` gets applied). Real dispatch is PR B (`docs/plans/2026-05-29-bullmq-batch-m365-excel-pr-b.md`).

## Context

The m365-excel queue serializes Excel writes per `fileId` and dispenses jobs via a leaky bucket (`max: 1, duration: 1000ms`). Every job makes one Graph call, so a burst of same-file writes becomes N sequential POSTs. We coalesce `createTableRow` jobs that share `(fileId, tableId)` into one Graph `POST /tables/:tableId/rows`, using BullMQ Pro 7.44's `batch` + `groupAffinity: true`.

**Architecture (decided):** instead of batching inside the shared queue/worker, route `createTableRow` jobs to a **dedicated batch queue** with its own worker. Other actions stay on the existing queue, byte-identical. This keeps all batching code and risk in the new queue + worker, and makes the batch queue **homogeneous** (`createTableRow` only), grouped by `(fileId, tableId, actionKey)` so every batch is a single table → exactly one POST.

**Serialization tradeoff (accepted — option a):** splitting `createTableRow` into its own queue means a `createTableRow` can run concurrently with another action on the same file (different queues), and two `createTableRow`s to different tables of the same file can run concurrently (group key includes `tableId`). This relaxes the previous per-file serialization. **Accepted.** A manual per-file lock (re-enqueue-with-delay if a file is busy) is a possible future addition — **out of scope here** (see Out of scope).

**Verified against the installed code:** BullMQ Pro 7.44 batch API exists (`WorkerProOptions.batch`, `job.getBatch()`, `job.setAsFailed()`). `enqueueActionJob` (`queues/action.ts:69`) routes by `appKey` and applies `getGroupConfigForJob` (which already queries the `Step`). `makeActionJobId`/`getActionJob` encode the queue name into the `ExecutionStep.jobId`, so a second queue's jobs retry/resolve with no schema change.

## Goals

- A dedicated `createTableRow` batch queue (group key `(fileId, tableId, actionKey)`, `concurrency = BATCH_SIZE`, scaled rate limit) + a separate `makeBatchActionWorker`, both created only when the flag is on.
- Enqueue-time routing: `createTableRow` (m365-excel) → batch queue; everything else → existing queue. One shared `Step` fetch for routing + grouping.
- **Flag off = byte-identical to today** (no batch queue/worker; routing never diverts).
- Batch worker: N=1 processes normally (reuses the existing single-job path); N>1 throws a clear stub error after tagging `batchSize` (real dispatch is PR B).
- The existing m365-excel queue, `makeActionWorker`, and `processAction` are **unchanged in behavior** (only a shared extraction of the single-job processor, if needed for reuse).

## Non-goals

- Real N>1 dispatch / `create-table-row.runBatch` / per-item failure handling — PR B.
- The manual per-file lock — out of scope (documented only).
- Production flag flip; `minSize`/`timeout` tuning; Datadog dashboard refactor; batching other actions.

## Decisions made

- **Separate batch queue + worker for `createTableRow`** (not in-worker branching on the shared queue). The existing queue/worker/processAction path is untouched; other actions carry zero risk. Chosen per the serialization tradeoff (option a) the user accepted.
- **Batch queue group key = `${fileId}-${tableId}-${stepKey}`.** Homogeneous `createTableRow` + per-table grouping ⇒ one POST per batch ⇒ the simplest possible failure model (PR B). The existing queue keeps group key = `fileId`.
- **Route by step key at enqueue time.** In `enqueueActionJob`, fetch the `Step` once; if the app has a batch queue and `step.key` is batchable (`createTableRow`), enqueue to the batch queue with the batch group config; else the existing queue with `fileId` grouping. Reuse the single fetch for both routing and grouping.
- **Flag gating = batch queue existence.** The queue config exposes `batch` only when the flag is on; the batch queue/worker are registered only then; routing checks for the batch queue's presence. Flag off ⇒ no divergence.
- **Reuse the single-job processor for N=1.** Extract `makeActionWorker`'s processor body into a shared `processSingleActionJob` (behavior-preserving) so the batch worker uses it verbatim for N=1; only the N>1 path is new.
- **Rate limits are per-queue.** Existing queue stays `max: 1, duration: interval`. Batch queue: `max: BATCH_SIZE, duration: BATCH_SIZE * M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS` (per-job `INCR` would otherwise cap batches at 1). Note: the two queues have independent rate budgets — combined Graph rate to a file can exceed today's single budget; revisit if it strains the tenant agreement.
- **`BATCH_SIZE = 20`**, hardcoded with a rationale comment (well under Graph's ~4MB ceiling). Defer 413 handling. `minSize`/`timeout` supported in the type, unset for now.

## Files touched

- `packages/types/index.d.ts` (modify) — add `batch?: { size: number; minSize?: number; timeout?: number; groupAffinity: true; actionKeys: string[]; getGroupConfigForJob(jobData): Promise<JobsProOptions['group']> }` to `IAppQueue` (the batch-queue grouping + which action keys route to it).
- `packages/backend/src/config/app-env-vars/m365.ts` (modify) — `M365_EXCEL_BATCH_ENABLED` (`=== 'true'`, default false) + `M365_EXCEL_BATCH_SIZE` (=20).
- `packages/backend/src/apps/m365-excel/queue/index.ts` (modify) — when flag on, add `batch` (actionKeys: `['createTableRow']`, `getGroupConfigForJob` → `${fileId}-${tableId}-${stepKey}`, `size`, `groupAffinity: true`). Existing `getGroupConfigForJob`/`groupLimits`/`queueRateLimit` unchanged.
- `packages/backend/src/queues/action.ts` (modify) — register a batch queue (`{app-actions-${appKey}-batch}`) for apps whose `queue.batch` is set; store in `actionQueuesByName` + a new `appBatchActionQueues` record. In `enqueueActionJob`, add routing: fetch `Step` once, route batchable keys to the batch queue with `batch.getGroupConfigForJob`, else existing behavior.
- `packages/backend/src/workers/helpers/make-action-worker.ts` (modify) — extract the processor body into exported `processSingleActionJob(job, ctx)`; export `convertParamsToBullMqOptions`. Behavior unchanged.
- `packages/backend/src/workers/helpers/make-batch-action-worker.ts` (create) — options incl. `workerOptions.batch`; processor tags span `batchSize`, then `getBatch().length > 1` → throw `UnrecoverableError('Batch dispatch not yet implemented (N jobs)')`, else → `processSingleActionJob`.
- `packages/backend/src/workers/action.ts` (modify) — for apps with a batch queue, also create `makeBatchActionWorker` for it (new `appBatchActionWorkers` record), only when the flag is on.
- `packages/backend/src/queues/__tests__/*`, `packages/backend/src/apps/m365-excel/__tests__/queue.test.ts` (modify) — routing + flag-off parity + flag-on wiring.
- `packages/backend/src/workers/__tests__/action.batch.itest.ts` (create) — flag-on: `createTableRow` routes to batch queue; N=1 processes; N>1 throws stub with `batchSize` tagged; other actions still route to the existing queue.

## Phases

### Phase 1: Types + env flag

- [x] Add `batch?` (with `actionKeys` + `getGroupConfigForJob`) to `IAppQueue`.
- [x] Add `M365_EXCEL_BATCH_ENABLED` + `M365_EXCEL_BATCH_SIZE` (=20) to `m365.ts`.

Files: `packages/types/index.d.ts`, `packages/backend/src/config/app-env-vars/m365.ts`
Verify: typecheck clean.

### Phase 2: Queue config (flag-gated)

- [x] Add the flag-gated `batch` block to the m365-excel queue config (actionKeys `['createTableRow']`, group `${fileId}-${tableId}-${stepKey}`, `size = BATCH_SIZE`, scaled batch-queue rate limit). Existing config unchanged. NOTE: the `batch` type carries no rate-limit field; the scaled batch-queue rate limit is derived during queue/worker registration (Phase 3/5) from `queueRateLimit × size`.

Files: `packages/backend/src/apps/m365-excel/queue/index.ts`
Verify: flag-off → `batch` undefined, config identical to today; flag-on → `batch` populated correctly (Phase 6 test).

### Phase 3: Batch queue registration + enqueue routing

- [ ] Register `{app-actions-${appKey}-batch}` for apps with `queue.batch`; add to `actionQueuesByName` + `appBatchActionQueues`.
- [ ] In `enqueueActionJob`, fetch the `Step` once and route batchable keys to the batch queue (batch group config), else existing behavior.

Files: `packages/backend/src/queues/action.ts`
Verify: flag-on → a `createTableRow` job lands in the batch queue with group `fileId-tableId-createTableRow`; a `writeCellValues` job lands in the existing queue with group `fileId`. Flag-off → both in the existing queue.

### Phase 4: Extract `processSingleActionJob` (behavior-preserving)

- [ ] Lift `makeActionWorker`'s processor body into exported `processSingleActionJob`; export `convertParamsToBullMqOptions`.

Files: `packages/backend/src/workers/helpers/make-action-worker.ts`
Verify: existing `action.itest.ts` + worker unit tests pass unchanged (pure refactor).

### Phase 5: Batch worker + bootstrap wiring

- [ ] Implement `make-batch-action-worker.ts` (batch options; `batchSize` tag; N=1 → `processSingleActionJob`; N>1 → stub throw).
- [ ] In `workers/action.ts`, create the batch worker for apps with a batch queue (flag-gated).

Files: `packages/backend/src/workers/helpers/make-batch-action-worker.ts`, `packages/backend/src/workers/action.ts`
Verify: flag-off → no batch worker. Flag-on → batch worker on the batch queue; N=1 processes; N>1 throws stub.

### Phase 6: Tests

- [ ] Unit: queue config (flag-off parity + flag-on wiring); enqueue routing (createTableRow→batch, others→existing, flag-off→existing).
- [ ] Itest: `action.batch.itest.ts` (flag-on N=1 processes; N>1 throws stub; `batchSize` tagged).

Files: `packages/backend/src/apps/m365-excel/__tests__/queue.test.ts`, `packages/backend/src/queues/__tests__/*`, `packages/backend/src/workers/__tests__/action.batch.itest.ts`
Verify: scoped vitest passes; full m365-excel + worker/queue suites green.

## Out of scope (documented per user request — not planned)

- **Manual per-file lock.** Because option (a) accepts concurrent same-file writes across the two queues / across tables, the user may later add a manual lock: before processing, check a per-`fileId` lock; if the file is busy, re-enqueue the job with a delay instead of writing. This would restore per-file serialization on top of the batch queue. Not designed or planned here.
- **Cross-queue rate coordination.** The two queues have independent rate budgets; if the combined Graph rate to a file strains the tenant agreement, coordinate them. Not addressed here.

## Edge cases considered

- **Flag off** — no `batch` config → no batch queue/worker, routing never diverts → zero change for m365 and all other apps.
- **Flag on, N=1** — batch worker routes to `processSingleActionJob` → identical to single-job behavior.
- **Flag on, N>1** — `batchSize` tagged, then stub throw (visible in error rates; staging reads `batchSize` from failing spans).
- **`createTableRow` with missing/variable `tableId`** — group key needs `tableId`; if absent the routing/group helper throws (mirror today's `fileId`-missing handling).
- **Retry of a batch-queue job** — `jobId` encodes the batch queue name; `getActionJob` resolves it from `actionQueuesByName`. Confirm the batch queue is registered there.
- **Mixed-version deploy** — flag stays off through PR A; no divergence.

## Verification

1. Typecheck/lint clean.
2. Unit: queue config + routing tests.
3. Itest: `action.batch.itest.ts` (testcontainers Redis/PG).
4. Regression: existing `action.itest.ts` + m365-excel action itests green (existing queue/worker path untouched; flag off elsewhere).
5. Staging: set `M365_EXCEL_BATCH_ENABLED=true`, drive concurrent `createTableRow` submissions to one file/table, read the `batchSize` Datadog distribution to size `minSize`/`timeout` before PR B.

## Open questions

1. **`minSize`/`timeout`** — unset; a small fill `timeout` may help batches form under moderate concurrency. Decide from staging `batchSize`.
2. **Datadog span semantics** under batching — confirm with the dashboard owner before a prod flag flip (PR B concern).
