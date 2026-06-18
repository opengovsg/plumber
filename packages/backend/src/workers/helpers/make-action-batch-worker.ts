import type {
  IActionBatchQueue,
  IActionJobData,
  RunBatchJobResult,
} from '@plumber/types'

import {
  type JobPro,
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'
import { type Span } from 'dd-trace'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import { M365_BATCH_SIZE, WORKER_CONCURRENCY } from '@/config/workers'
import { handleFailedStepAndThrow } from '@/helpers/actions'
import { exponentialBackoffWithJitter } from '@/helpers/backoff'
import { withLock } from '@/helpers/distributed-lock'
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import ExecutionStep from '@/models/execution-step'
import { makeActionJobId } from '@/queues/action'
import {
  prepareActionExecution,
  type PreparedActionExecution,
  recordExecutionStep,
  resolveLockKey,
  resolveNextStep,
  setActionOutputError,
} from '@/services/action'

import { advanceAfterStep } from './advance-after-step'
import { handleFailedJob } from './handle-failed-job'
import { fileLockRequeueDelayMs } from './requeue-on-file-lock-contention'
import { registerWorkerEventHandlers } from './worker-event-handlers'

function convertParamsToBatchWorkerOptions(
  params: MakeActionBatchWorkerParams,
): { queueName: string; workerOptions: WorkerProOptions } {
  const { appKey, queueName, batchConfig } = params

  const concurrency =
    WORKER_CONCURRENCY[appKey as keyof typeof WORKER_CONCURRENCY] ||
    appConfig.workerActionConcurrency

  const workerOptions: WorkerProOptions = {
    connection: createRedisClient(),
    // NOTE: with batching, `concurrency` counts BATCHES, not individual jobs -
    // one synthetic container job is processed per batch (see bullmq-pro
    // worker-pro.js:102-143). So this many batches (across DIFFERENT files) run
    // at once, which is safe and desired; same-file writes are serialized by the
    // per-file Redis lock below, not by this.
    concurrency,
    settings: {
      backoffStrategy: exponentialBackoffWithJitter,
    },
    // Fetch up to M365_BATCH_SIZE jobs from a single group at a time.
    // groupAffinity guarantees a batch never mixes groups, so every job in a
    // batch shares the same `${fileId}::${tableId}::${connectionId}` and
    // `runBatch` can collapse them into exactly one multi-row insert. minSize: 1
    // means we never wait to fill a batch (partial batches are processed
    // immediately).
    batch: {
      size: M365_BATCH_SIZE,
      groupAffinity: true,
    },
    // group.concurrency is a per-group cap on JOBS in flight (it must be >=
    // batch.size, else a full batch can't be admitted - see the queue/batch.ts
    // rate-limit note). It is a throughput cap ONLY and is NOT relied on for
    // write serialization: bullmq-pro group concurrency cannot guarantee one
    // batch per group (partial batches under trickle load let a second batch
    // start), and it serializes nothing across the per-app queue or other worker
    // PROCESSES. Same-file write serialization is the per-file distributed lock's
    // job (acquired around runBatch via the action's getLockKey hook), which is
    // Redis-based precisely so it spans processes.
    group: {
      concurrency: M365_BATCH_SIZE,
    },
  }

  if (batchConfig.queueRateLimit) {
    workerOptions.limiter = batchConfig.queueRateLimit
  }

  return { queueName, workerOptions }
}

interface MakeActionBatchWorkerParams {
  appKey: string
  queueName: string
  batchConfig: IActionBatchQueue
}

/**
 * A job whose execution context built successfully (helper A). It is a candidate
 * for the shared `runBatch` write; runBatch then validates it (params + per-user
 * access) and reports per-job whether it committed or was excluded.
 */
type PreparedJob = {
  batchJob: JobPro<IActionJobData>
  jobId: string
  prepared: PreparedActionExecution
}

/**
 * A job that failed BEFORE committing (a prepare failure, or a runBatch-reported
 * validation failure). `prepared` is the context when prepare succeeded (so we
 * can record a failure step against it), or `null` if prepare itself failed.
 */
type FailedJob = {
  batchJob: JobPro<IActionJobData>
  jobId: string
  prepared: PreparedActionExecution | null
  error: unknown
}

/**
 * The per-invocation context shared by the batch processing steps below: the
 * queue name (for failure side-effects), plus the worker, the synthetic
 * container job, and the active span (for rate-limit classification, execution
 * advancement, and tracing).
 */
type BatchContext = {
  queueName: string
  worker: WorkerPro<IActionJobData>
  job: JobPro<IActionJobData>
  span: Span | null
}

/**
 * The for-each iteration slot to patch on failure. `executionId` / `iteration`
 * live on `job.data` even when prepare failed, so a failed for-each iteration is
 * still patchable from either the prepared context or the raw job data.
 */
function resolveIterationTarget(
  prepared: PreparedActionExecution | null,
  batchJob: JobPro<IActionJobData>,
) {
  return {
    executionId: prepared?.execution.id ?? batchJob.data.executionId,
    iteration:
      prepared?.metadata.iteration ?? batchJob.data.metadata?.iteration,
  }
}

/**
 * Bookkeeping shared by BOTH failure-delivery paths (`setAsFailed` and the
 * all-or-none throw): record a failure execution-step - ONLY when prepare
 * succeeded, since a prepare failure has no `$` / actionOutput to record against
 * (matching the single-job path, where a prepare failure surfaces only as the
 * execution's failed status, with no step) - then patch the for-each iteration
 * slot to 'failure', or the for-each hangs forever on the null slot. Returns the
 * recorded step (or null) so the throw path can read its `errorDetails`. Order is
 * record-then-patch.
 */
async function recordFailure({
  prepared,
  batchJob,
  jobId,
  error,
}: FailedJob): Promise<ExecutionStep | null> {
  let step: ExecutionStep | null = null
  if (prepared) {
    setActionOutputError(prepared.$, error)
    step = await recordExecutionStep({
      prepared,
      runResult: {},
      executionError: error,
      jobId,
    })
  }

  const { executionId, iteration } = resolveIterationTarget(prepared, batchJob)
  if (iteration) {
    await ExecutionStep.patchIterationStatus(executionId, iteration, 'failure')
  }

  return step
}

/**
 * Up-front span tags describing the batch shape, emitted before any work so a
 * batch stays observable even if it later throws.
 */
function tagBatchStart(ctx: BatchContext, batchSize: number): void {
  ctx.span?.addTags({
    queueName: ctx.queueName,
    'batch.size': batchSize,
    'batch.configured_size': M365_BATCH_SIZE,
    'batch.fill_ratio': batchSize / M365_BATCH_SIZE,
    // One multi-row insert replaces `batchSize` single-row inserts.
    'm365.api_calls_saved': batchSize - 1,
    workerVersion: appConfig.version,
  })
}

/**
 * The single place that derives the batch-outcome span tags, so the branches
 * that emit them (all-prepare-failed, write-failure, resolve) can't drift:
 * 'success' when nothing failed, 'partial' when some committed alongside
 * failures, else 'failed'.
 */
function tagBatchOutcome(
  span: Span | null,
  {
    runMs,
    succeeded,
    failed,
  }: { runMs: number; succeeded: number; failed: number },
): void {
  span?.addTags({
    'batch.outcome':
      failed === 0 ? 'success' : succeeded > 0 ? 'partial' : 'failed',
    'batch.run_ms': runMs,
    'batch.succeeded_count': succeeded,
    'batch.failed_count': failed,
  })
}

/**
 * FAILURE DELIVERY A - per-job isolation. A `setAsFailed` member emits NO
 * `failed` event (bullmq-pro moves it straight to the failed set on the resolve
 * path), so - unlike the all-or-none throw path - we run its side-effects here,
 * not via the worker.on('failed') fan-out. The setAsFailed error MUST be
 * UnrecoverableError, or the member would re-enter a future batch and re-run
 * runBatch -> duplicate rows.
 */
async function isolateFailedJob(
  ctx: BatchContext,
  failed: FailedJob,
): Promise<void> {
  const { batchJob, jobId, error } = failed
  const { executionId } = resolveIterationTarget(failed.prepared, batchJob)
  const permanentError = new UnrecoverableError(
    error instanceof Error ? error.message : String(error),
  )
  batchJob.setAsFailed(permanentError)

  try {
    // Records the ORIGINAL error; only handleFailedJob below gets the
    // UnrecoverableError wrapper.
    await recordFailure(failed)

    // setStatus('failure') + de-duped error email. Passing the UnrecoverableError
    // makes handleFailedJob skip its retry guard so the side-effects always run
    // (the fan-out never fires for this job).
    await handleFailedJob(batchJob, permanentError, ctx.queueName)
  } catch (err) {
    // The job is already setAsFailed above (so it lands in the failed set); only
    // its bookkeeping failed. Don't rethrow - a throw here would re-run runBatch
    // and duplicate the committed rows.
    logger.error(
      'Failed to isolate pre-write-failed batched job; execution may stall',
      {
        err,
        jobId,
        flowId: batchJob.data.flowId,
        executionId,
      },
    )
  }
}

/**
 * Finalize a job whose row committed: record its success step, resolve the next
 * step, and advance the execution. Wrapped in catch-log-continue because NOTHING
 * may throw out of the processor after a successful write - a throw re-runs
 * runBatch and duplicates the committed rows.
 */
async function finalizeSucceededJob(
  ctx: BatchContext,
  { prepared, jobId }: PreparedJob,
): Promise<void> {
  try {
    const executionStep = await recordExecutionStep({
      prepared,
      runResult: {},
      executionError: null,
      jobId,
    })
    const nextStep = await resolveNextStep({
      prepared,
      runResult: {},
    })
    await advanceAfterStep({
      processResult: {
        flowId: prepared.flow.id,
        executionId: prepared.execution.id,
        nextStep,
        executionStep,
        nextStepMetadata: { ...prepared.metadata },
        executionError: null,
      },
      currStep: prepared.step,
      context: {
        isQueueDelayable: false,
        span: ctx.span,
        worker: ctx.worker,
        job: ctx.job,
      },
    })
  } catch (err) {
    logger.error('Failed to finalize batched action job; execution may stall', {
      err,
      jobId,
      flowId: prepared.flow.id,
      executionId: prepared.execution.id,
      stepId: prepared.step.id,
    })
  }
}

/**
 * Phase A - build each job's execution context (helper A), PER JOB, then
 * partition in batch order (so the shared write preserves row order). A prepare
 * failure (deleted step, bad context) is isolated to that job instead of sinking
 * the batch; the rest go on to the shared write. VALIDATION is NOT done here -
 * runBatch owns it and reports, per job, which committed vs. were excluded. It
 * parses each job's params individually (so one bad-input job is isolated) and
 * authorizes file access once for the batch (the batch group key pins every job
 * to one connection, so one access check covers them all) - without the worker
 * carrying app-specific validation.
 */
async function prepareBatch(
  queueName: string,
  batchJobs: JobPro<IActionJobData>[],
): Promise<{ preparedOk: PreparedJob[]; prepareFailed: FailedJob[] }> {
  const jobIds = batchJobs.map((batchJob) =>
    makeActionJobId(queueName, batchJob.id),
  )

  const prepareResults = await Promise.all(
    batchJobs.map(async (batchJob, index) => {
      const jobId = jobIds[index]
      try {
        const prepared = await prepareActionExecution({
          ...batchJob.data,
          jobId,
        })
        return { batchJob, jobId, prepared, error: null as unknown }
      } catch (error) {
        return {
          batchJob,
          jobId,
          prepared: null as PreparedActionExecution | null,
          error,
        }
      }
    }),
  )

  const preparedOk: PreparedJob[] = []
  const prepareFailed: FailedJob[] = []
  for (const { batchJob, jobId, prepared, error } of prepareResults) {
    if (prepared) {
      preparedOk.push({ batchJob, jobId, prepared })
    } else {
      prepareFailed.push({ batchJob, jobId, prepared: null, error })
    }
  }

  return { preparedOk, prepareFailed }
}

/**
 * WRITE-FAILURE PATH: the write did NOT commit, so it stays all-or-none. EVERY
 * job rides this single throw and is handled by the worker.on('failed') fan-out.
 * We must NOT mix `setAsFailed` here: a throw fails every member with the thrown
 * error, ignoring per-job failedError. Record a failure step for each prepared
 * job and patch every for-each iteration slot (prepared + prepare-failed, so a
 * for-each doesn't hang), THEN throw once so the batch retries per `attempts`.
 */
async function failBatch(
  ctx: BatchContext,
  {
    preparedOk,
    prepareFailed,
    runBatchError,
    runMs,
    batchSize,
  }: {
    preparedOk: PreparedJob[]
    prepareFailed: FailedJob[]
    runBatchError: unknown
    runMs: number
    batchSize: number
  },
): Promise<never> {
  tagBatchOutcome(ctx.span, { runMs, succeeded: 0, failed: batchSize })

  // Record a failure step + patch the iteration for every prepared job; capture
  // the last step's errorDetails for the throw below (every prepared job shares
  // runBatchError, so any one is fine).
  let errorDetails: ExecutionStep['errorDetails'] = null
  for (const { batchJob, jobId, prepared } of preparedOk) {
    const step = await recordFailure({
      batchJob,
      jobId,
      prepared,
      error: runBatchError,
    })
    errorDetails = step!.errorDetails
  }

  // Prepare-failed for-each iterations also need their slot patched (a mixed
  // for-each would otherwise hang on the null slot when it rides this throw).
  // recordFailure on a null-prepared job skips the step and only patches the
  // iteration - this is iteration bookkeeping, NOT a setAsFailed side-effect, so
  // it is safe to combine with the throw below.
  for (const failedJob of prepareFailed) {
    await recordFailure(failedJob)
  }

  return handleFailedStepAndThrow({
    errorDetails,
    executionError: runBatchError,
    context: {
      // The batch queue is not queue-delayable; createTableRow only emits
      // step/group delays. Pass the batch container job for rate-limit / group
      // classification.
      isQueueDelayable: false,
      span: ctx.span,
      worker: ctx.worker,
      job: ctx.job,
    },
  })
}

/**
 * RESOLVE PATH: the write completed. runResults aligns with preparedOk: split
 * into committed (success) and runBatch-isolated (failed), then merge the latter
 * with the prepare-failures. NOTHING here may throw out of the processor (a throw
 * re-runs runBatch -> duplicate rows), so every per-job step is
 * catch-log-continue.
 *
 * Isolate failures FIRST so a failed for-each iteration's slot is 'failure'
 * before a committed sibling's processForEachStatus checks completion -> the
 * for-each resolves to failure deterministically (it must never resolve to
 * success while a sibling iteration failed).
 */
async function finalizeBatch(
  ctx: BatchContext,
  {
    preparedOk,
    prepareFailed,
    runResults,
    runMs,
  }: {
    preparedOk: PreparedJob[]
    prepareFailed: FailedJob[]
    runResults: RunBatchJobResult[]
    runMs: number
  },
): Promise<void> {
  const succeeded: PreparedJob[] = []
  const runFailed: FailedJob[] = []
  preparedOk.forEach((preparedJob, index) => {
    const result = runResults[index]
    if (result.status === 'failed') {
      runFailed.push({
        batchJob: preparedJob.batchJob,
        jobId: preparedJob.jobId,
        prepared: preparedJob.prepared,
        error: result.error,
      })
    } else {
      succeeded.push(preparedJob)
    }
  })
  const allFailed = [...prepareFailed, ...runFailed]

  tagBatchOutcome(ctx.span, {
    runMs,
    succeeded: succeeded.length,
    failed: allFailed.length,
  })

  for (const failedJob of allFailed) {
    await isolateFailedJob(ctx, failedJob)
  }

  for (const succeededJob of succeeded) {
    await finalizeSucceededJob(ctx, succeededJob)
  }
}

/**
 * Re-queue the whole batch on sustained per-file lock contention WITHOUT
 * consuming an attempt. RateLimitError-based re-queue does NOT work for a batch:
 * bullmq-pro's `moveToWait` isn't batch-aware, so the synthetic container would
 * move its fake id to wait and STRAND the member jobs in `active`. Instead move
 * each member to `delayed` ourselves: `moveToDelayed` uses skipAttempt (so
 * attemptsMade is untouched) and the pro Lua decrements the group's concurrency
 * (so the group isn't wedged). Members share the container's lock token. Then
 * empty the synthetic container so its normal completion is a no-op for members
 * and bullmq fetches the next batch. Done BEFORE any execution step is recorded
 * -> no spurious failure step, and because no attempt is burned, sustained
 * contention can retry unbounded (the lock holder always finishes or its TTL
 * expires, so a contender always eventually wins). withLock's short up-front
 * acquire retry already absorbs brief contention without re-queueing; this only
 * fires on sustained contention.
 */
async function requeueBatchOnContention(ctx: BatchContext): Promise<void> {
  const { job, span } = ctx
  span?.addTags({ 'lock.requeued': true })
  const requeueAt = Date.now() + fileLockRequeueDelayMs()
  await Promise.all(
    job.getBatch().map((member) => member.moveToDelayed(requeueAt, job.token)),
  )
  job.setBatch([])
}

/**
 * Processes one batch: build each job's context, isolate the pre-write failures,
 * and - if any healthy jobs remain - run the shared write under the per-file lock
 * (dispatching to the write-failure or resolve path). See makeActionBatchWorker's
 * doc comment for the all-or-none vs per-job-isolation contract.
 */
async function processBatch(ctx: BatchContext): Promise<void> {
  const { span, job } = ctx
  const batchJobs = job.getBatch()
  tagBatchStart(ctx, batchJobs.length)

  const { preparedOk, prepareFailed } = await prepareBatch(
    ctx.queueName,
    batchJobs,
  )

  // Every job failed to prepare: nothing to write, no lock needed. Isolate each
  // (setAsFailed + side-effects) and return so the batch completes with every
  // member in the failed set (no Graph POST at all).
  if (preparedOk.length === 0) {
    tagBatchOutcome(span, {
      runMs: 0,
      succeeded: 0,
      failed: prepareFailed.length,
    })
    for (const failedJob of prepareFailed) {
      await isolateFailedJob(ctx, failedJob)
    }
    return
  }

  // The action (with runBatch) is resolved from a prepared job. A job reaching
  // the batch queue for an action without runBatch is a routing/config bug
  // affecting the whole batch -> fail without retry.
  const action = preparedOk[0].prepared.actionCommand
  if (!action?.runBatch) {
    throw new UnrecoverableError(
      `Action ${preparedOk[0].prepared.step.appKey}/${preparedOk[0].prepared.step.key} does not implement runBatch`,
    )
  }

  // Every prepared job shares one `${fileId}::${tableId}::${connectionId}` group,
  // so one lock key (from the app queue's getLockKey) covers the batch. Taken
  // BEFORE any
  // execution-step insert: on contention the whole batch is re-queued onto its
  // group (no attempt consumed, no failure steps recorded). Released in
  // withLock's `finally` after the write + bookkeeping.
  const lockKey = await resolveLockKey(preparedOk[0].prepared.$)

  await withLock(
    lockKey,
    async () => {
      // runBatch parses each prepared job's params and authorizes file access
      // once for the batch, writes the valid ones in one POST, and RETURNS a
      // per-job outcome aligned to the jobs passed. It THROWS only for a genuine
      // write failure (the POST itself) - the single all-or-none retry point.
      // Pass the prepared jobs in order so each returned outcome lines up by
      // index.
      let runResults: RunBatchJobResult[] = []
      let runBatchError: unknown = null
      const runStart = Date.now()
      try {
        runResults = await action.runBatch(
          preparedOk.map(({ prepared }) => ({ $: prepared.$ })),
        )
      } catch (error) {
        runBatchError = error
      }
      const runMs = Date.now() - runStart

      if (runBatchError) {
        return failBatch(ctx, {
          preparedOk,
          prepareFailed,
          runBatchError,
          runMs,
          batchSize: batchJobs.length,
        })
      }

      await finalizeBatch(ctx, { preparedOk, prepareFailed, runResults, runMs })
    },
    {
      span,
      onContention: () => requeueBatchOnContention(ctx),
    },
  )
}

/**
 * Creates a batch worker for an action batch queue. Jobs sharing a group (e.g.
 * `${fileId}::${tableId}::${connectionId}`) are fetched together (up to
 * M365_BATCH_SIZE) and collapsed into a single `action.runBatch(...)` call - one
 * multi-row operation for the whole batch.
 *
 * The atomic multi-row write is all-or-none: if `runBatch` throws, the whole
 * batch fails and retries (nothing committed). Nothing after a successful
 * `runBatch` may throw, because a throw re-runs the processor (and thus
 * `runBatch`), which would duplicate the committed rows - so per-job bookkeeping
 * after a successful write is wrapped in catch-log-continue.
 *
 * Per-job PRE-WRITE failures are isolated (partial batches): a job that fails to
 * prepare or validate (bad params / deleted step / revoked file access) is
 * `setAsFailed` and excluded from the write, while the healthy jobs still commit.
 * `setAsFailed` rides the resolve path only (a processor throw would fail every
 * member with the thrown error, ignoring per-job `failedError`), and uses
 * `UnrecoverableError` so an isolated job is never retried into a future batch.
 */
export function makeActionBatchWorker(
  params: MakeActionBatchWorkerParams,
): WorkerPro<IActionJobData> {
  const { queueName, workerOptions } = convertParamsToBatchWorkerOptions(params)

  const worker: WorkerPro<IActionJobData> = new WorkerPro<IActionJobData>(
    queueName,
    // Fix the trace service name to workers.action.batch regardless of queue
    // name, so all batch processing is monitored together.
    tracer.wrap('workers.action.batch', async (job) =>
      processBatch({ queueName, worker, job, span: tracer.scope().active() }),
    ),
    workerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
