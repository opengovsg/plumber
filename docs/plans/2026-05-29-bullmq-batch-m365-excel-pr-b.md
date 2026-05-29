# BullMQ Pro batching for m365-excel — PR B (batch dispatch + create-table-row.runBatch)

**Status:** Not started
**Created:** 2026-05-29
**Last updated:** 2026-05-29

## Resume from here

Depends on PR A (`docs/plans/2026-05-29-bullmq-batch-m365-excel-pr-a.md`): the dedicated `createTableRow` batch queue, enqueue-time routing, the separate `makeBatchActionWorker` (stub on N>1, `batchSize` metric, N=1 → shared `processSingleActionJob`), and the worker wiring. PR B replaces the stub with real dispatch and ships `create-table-row.runBatch`. The existing m365-excel queue, `makeActionWorker`, and the single-job path are **untouched** (only behavior-preserving extractions of shared helpers). Start at Phase 1.

## Context

PR A isolated all batching to a dedicated queue grouped by `(fileId, tableId, actionKey)`. Because that queue is **homogeneous `createTableRow`** and grouped per table, **every batch is one `(fileId, tableId)` → exactly one Graph POST.** That removes the hard parts of the original single-queue design: no partition-by-`step.key`, no sub-grouping by `tableId`, and no multi-write "duplicate-on-bail" risk (a batch makes one write — it either fully succeeds or fully fails, having written nothing).

The batch worker gets one representative job; `job.getBatch()` returns all siblings (same `(fileId, tableId)` createTableRow). N=1 already delegates to `processSingleActionJob`. For N>1, PR B's `processActionBatch` prepares each item, calls `create-table-row.runBatch` once for the whole batch (one POST), finalizes each item, and completes/fails each job.

**Defining constraint (verified in `@taskforcesh/bullmq-pro` `job-pro.js`):** `setAsFailed(err)` sets `job.failedError`; on processor return, `moveBatchToCompleted` fails those jobs via `moveToFailed(err, token, false)` (normal backoff; `UnrecoverableError` ⇒ no retry) and completes the rest. **A `throw` fails the entire batch.** Per-item failures (e.g. one schema-invalid item) must therefore be `setAsFailed`, not `throw` — that's the only reason per-item handling exists; the actual Graph write is a single all-or-nothing POST.

## Goals

- Replace the batch worker's N>1 stub with `processActionBatch`: parallel prepare → one `create-table-row.runBatch` call (one POST) → parallel finalize → per-item complete/`setAsFailed`.
- Ship `create-table-row.runBatch`: validate each item, drop schema-invalid ones, build one multi-row `values` array, issue one POST, set each surviving item's `sheetRowNumber`.
- **Single-job and test-run behavior byte-identical** — both paths call the same extracted helpers; the existing queue/worker are untouched.

## Non-goals

- Batching actions other than `createTableRow` (the batch queue only receives `createTableRow`).
- The manual per-file lock and cross-queue rate coordination — out of scope (see PR A).
- `minSize`/`timeout` tuning; Datadog refactor; Graph tenant sign-off (before prod flip).
- Removing `RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024` (preserve; flag for cleanup).

## Decisions made

- **Batch = one POST.** The homogeneous, per-table batch queue means `processActionBatch` calls `runBatch` once with the whole batch; `runBatch` issues a single `POST /tables/:tableId/rows`. No partitioning, no sub-grouping.
- **Failure model (simplified):**
  - Schema-invalid item → `markFailed(StepError, { retryable: false })`, dropped before the POST.
  - POST success → finalize all surviving items (each gets its `sheetRowNumber` from the one response).
  - POST failure → `markFailed(err, { retryable: true })` all surviving items (they share the one write, which wrote nothing). `processActionBatch` runs `classifyStepFailure(err)`: rate-limit kinds (429 `group` / 429-generic & 509 `queue`, from `request-error-handler.ts`) → apply `worker.rateLimitGroup`/`rateLimit` + `setAsFailed(retryable)`; step-retry → `setAsFailed(retryable)`; else → `setAsFailed(UnrecoverableError)`.
  - The processor never `throw`s for per-item failures.
- **`runBatch` contract:** `runBatch(items: { $: IGlobalVariable; markFailed: (err: Error, opts?: { retryable?: boolean }) => void }[]): Promise<void>`. `create-table-row.runBatch`: per-item `parametersSchema.safeParse` (invalid → `markFailed(_, { retryable: false })`, drop) → acquire one `WorkbookSession`, fetch header once, build one `values` array from survivors, one POST → per-item `sheetRowNumber` + `setActionItem`; on POST throw → `markFailed(err, { retryable: true })` every surviving item. (May defensively assert all items share `tableId`, guaranteed by the queue grouping.)
- **`run` becomes a thin shim over `runBatch`** via `runSingleViaBatch`, preserving the test-run rate-limit and `metadata` (test runs reach `createTableRow` via `processAction → run`, N=1, synchronous, so `runBatch` must handle a `testRun` item).
- **Sharing = extract pure pieces, reuse in both paths:** `prepareActionContext` + `finalizeActionStep` (from `processAction`), `classifyStepFailure` (from `handle-failed-step-and-throw.ts`, returns kind + finalError), `handleSuccessfulStepResult` (from `processSingleActionJob`'s success branch). All behavior-preserving; existing itests guard parity.
- **Split PR B into B1 (Phases 1–2) + B2 (Phase 3)** optional, for smaller merges. B1 proves dispatch machinery; B2 adds the coalescing POST.
- **Spike before building:** confirm (a) `setAsFailed(Error)` retries per backoff and `setAsFailed(UnrecoverableError)` doesn't; (b) `worker.rateLimitGroup`/`rateLimit` apply backpressure *without* throwing `RateLimitError` (so the batch can rate-limit + retry its items while completing nothing-committed cleanly).

## Files touched

- `packages/types/index.d.ts` (modify) — add `runBatch?` to `IBaseAction`.
- `packages/backend/src/services/action.ts` (modify) — extract `prepareActionContext` + `finalizeActionStep`; `processAction` = `prepare → run → finalize` (unchanged behavior); export both.
- `packages/backend/src/helpers/actions/handle-failed-step-and-throw.ts` (modify) — extract `classifyStepFailure` (returns `{ kind: 'rate-limit-group'|'rate-limit-queue'|'retry-step'|'unrecoverable'; delayMs?; finalError }`); `handleFailedStepAndThrow` becomes a thin wrapper mapping kinds to its current throw / `worker.rateLimit` / `worker.rateLimitGroup` behavior.
- `packages/backend/src/workers/helpers/process-single-action-job.ts` (modify) — extract `handleSuccessfulStepResult` from its success branch (behavior-preserving). *(PR A's extraction file, not `make-action-worker.ts`.)*
- `packages/backend/src/workers/helpers/handle-successful-step-result.ts` (create) — shared success handler (enqueue-next / `processForEachStatus` / `setStatus`).
- `packages/backend/src/workers/helpers/process-action-batch.ts` (create) — parallel prepare → one `runBatch` → parallel finalize → per-item `setAsFailed` (via `classifyStepFailure`, applying the limiter on rate-limit kinds) / `handleSuccessfulStepResult`. Always returns normally.
- `packages/backend/src/workers/helpers/make-batch-action-worker.ts` (modify) — N>1 branch: replace the stub with `processActionBatch(...)`.
- `packages/backend/src/apps/m365-excel/actions/create-table-row/index.ts` (modify) — add `runBatch`; replace `run` with the `runSingleViaBatch` shim.
- `packages/backend/src/apps/m365-excel/common/run-single-via-batch.ts` (create) — shim: single `$` → 1-item `runBatch`, captures `markFailed`, re-throws (`UnrecoverableError` when `retryable: false`).
- `packages/backend/src/workers/__tests__/action.batch.itest.ts` (modify) — dispatch + failure-isolation matrix.
- `packages/backend/src/apps/m365-excel/__tests__/actions/create-table-row.batch.itest.ts` (create) — coalescing + schema-drop + failure cases (Graph mocked).

## Phases

### Phase 1: Types + shared pure-helper extraction (no behavior change) — PR B1

- [ ] Add `runBatch?` to `IBaseAction`.
- [ ] Extract `prepareActionContext` + `finalizeActionStep` from `processAction`.
- [ ] Extract `classifyStepFailure` from `handle-failed-step-and-throw.ts` (thin wrapper remains).
- [ ] Extract `handleSuccessfulStepResult` from `processSingleActionJob`'s success branch.

Files: `packages/types/index.d.ts`, `packages/backend/src/services/action.ts`, `packages/backend/src/helpers/actions/handle-failed-step-and-throw.ts`, `packages/backend/src/workers/helpers/process-single-action-job.ts`, `packages/backend/src/workers/helpers/handle-successful-step-result.ts`
Verify: typecheck clean; all existing `action.itest.ts` + m365-excel action itests pass unchanged (pure refactor).

### Phase 2: Real dispatch (`process-action-batch.ts`) — completes PR B1

- [ ] Implement `process-action-batch.ts` (prepare → single `runBatch` → finalize → per-item `setAsFailed`/`handleSuccessfulStepResult`; limiter backpressure on rate-limit kinds; never throws per-item).
- [ ] Point the batch worker's N>1 branch at `processActionBatch` (remove stub).
- [ ] Spike: itest for (a)/(b) above.

Files: `packages/backend/src/workers/helpers/process-action-batch.ts`, `packages/backend/src/workers/helpers/make-batch-action-worker.ts`, `packages/backend/src/workers/__tests__/action.batch.itest.ts`
Verify: N>1 batch processes; per-item prepare failure isolated; for-each iteration status patched per item; N=1 identical to single path. (Coalescing POST itself is Phase 3.)

### Phase 3: create-table-row.runBatch (the coalescing POST) — PR B2

- [ ] Implement `runBatch` in `create-table-row/index.ts` (per-item schema → one session/header/POST → per-item `sheetRowNumber` + `setActionItem`; `markFailed` per the failure model; preserve test-run rate-limit).
- [ ] Add `runSingleViaBatch`; make `run` a shim.

Files: `packages/backend/src/apps/m365-excel/actions/create-table-row/index.ts`, `packages/backend/src/apps/m365-excel/common/run-single-via-batch.ts`
Verify: 5 items same table → 1 POST, 5 rows; 1 of 5 schema-invalid → dropped non-retryably, other 4 in one POST; N=1 via shim identical to old `run`; test-run still rate-limited.

### Phase 4: Failure-matrix tests

- [ ] POST 500 → all surviving items retryable-fail, retry re-issues one POST (no duplicate rows, since the failed POST wrote nothing).
- [ ] 429 → group rate-limit applied + items retryable-fail; processor does not throw.
- [ ] `invalidSession` mid-call → items retryable-fail, session cleared from Redis, retry re-acquires.
- [ ] Finalize/enqueue failure for one item → `setAsFailed(UnrecoverableError)`, others commit.

Files: `packages/backend/src/workers/__tests__/action.batch.itest.ts`, `packages/backend/src/apps/m365-excel/__tests__/actions/create-table-row.batch.itest.ts`
Verify: integration suite passes (testcontainers Redis/PG; Graph mocked).

## Edge cases considered

- **Processor never throws for a per-item failure** — all per-item errors → `setAsFailed`. (Verified `moveBatchToCompleted`.)
- **Schema-invalid item** — dropped pre-POST via `markFailed(_, { retryable: false })`; the rest still POST.
- **POST failure** — one write, nothing committed → all surviving items `setAsFailed(retryable)`; retry re-issues one POST, no duplicates. 429 also applies `rateLimitGroup`.
- **Prepare failure** — `setAsFailed(UnrecoverableError)`, dropped pre-dispatch.
- **Finalize/enqueue failure** — `setAsFailed(UnrecoverableError)`; siblings unaffected.
- **For-each createTableRow** — routes to the batch queue; `finalizeActionStep` + `handleSuccessfulStepResult` run the for-each metadata/status per item. (Rarely co-batch due to the 2s stagger; correctness holds.)
- **Test run (N=1)** — `processAction → run → runSingleViaBatch → runBatch`; rate-limit + real POST preserved; throws on failure (not `setAsFailed`).
- **Concurrent same-(file,table) batches** — possible under partial batches at `concurrency = BATCH_SIZE` (accepted via option a; the future manual per-file lock would close it). Retry-safe because a failed POST writes nothing; the residual risk is two *successful* concurrent appends to one table.

## Verification

1. Typecheck/lint clean.
2. Phase 1 regression: existing `action.itest.ts` + m365-excel action itests green (refactor is behavior-preserving; existing queue/worker untouched).
3. Phase 2: dispatch itests + the setAsFailed/limiter spike.
4. Phase 3: coalescing itests (one POST per batch; schema-drop; shim parity).
5. Phase 4: failure-matrix itests.
6. Staging: flag on, concurrent submissions to one file/table; Datadog shows Graph POSTs drop ~`batchSize`×; no duplicate rows under induced retries.
7. Scope vitest to touched files during dev; run full batch + m365-excel suites before each PR.

## Open questions

1. **Ship B1 + B2 or one PR B?** Recommendation: optional split; the design is small enough that one PR B is also fine.
2. **`minSize`/`timeout`** (from PR A) — set from staging `batchSize`.
3. **Graph tenant rate-limit / burst sign-off** + **Datadog span semantics** — before prod flag flip.
