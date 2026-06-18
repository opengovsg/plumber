import type { IActionBatchQueue, IActionJobData } from '@plumber/types'

import {
  UnrecoverableError,
  WorkerPro,
  type WorkerProOptions,
} from '@taskforcesh/bullmq-pro'

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
  recordExecutionStep,
  resolveLockKey,
  resolveNextStep,
  setActionOutputError,
} from '@/services/action'

import { advanceAfterStep } from './advance-after-step'
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
    // batch shares the same `${fileId}::${tableId}` and `runBatch` can collapse
    // them into exactly one multi-row insert. minSize: 1 means we never wait to
    // fill a batch (partial batches are processed immediately).
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
 * Creates a batch worker for an action batch queue. Jobs sharing a group (e.g.
 * `${fileId}::${tableId}`) are fetched together (up to M365_BATCH_SIZE) and
 * collapsed into a single `action.runBatch(...)` call - one multi-row operation
 * for the whole batch.
 *
 * The processor has exactly one throw/retry point: `runBatch` itself. Nothing
 * after a successful `runBatch` may throw, because a throw re-runs the processor
 * (and thus `runBatch`), which would duplicate the committed rows. Per-job
 * bookkeeping after a successful write is therefore wrapped in catch-log-continue
 * (a bookkeeping failure stalls that one execution, but never duplicates rows).
 */
export function makeActionBatchWorker(
  params: MakeActionBatchWorkerParams,
): WorkerPro<IActionJobData> {
  const { queueName, workerOptions } = convertParamsToBatchWorkerOptions(params)

  const worker: WorkerPro<IActionJobData> = new WorkerPro<IActionJobData>(
    queueName,
    // Fix the trace service name to workers.action.batch regardless of queue
    // name, so all batch processing is monitored together.
    tracer.wrap('workers.action.batch', async (job) => {
      const span = tracer.scope().active()

      const batchJobs = job.getBatch()
      const batchSize = batchJobs.length

      span?.addTags({
        queueName,
        'batch.size': batchSize,
        'batch.configured_size': M365_BATCH_SIZE,
        'batch.fill_ratio': batchSize / M365_BATCH_SIZE,
        // One multi-row insert replaces `batchSize` single-row inserts.
        'm365.api_calls_saved': batchSize - 1,
        workerVersion: appConfig.version,
      })

      const jobIds = batchJobs.map((batchJob) =>
        makeActionJobId(queueName, batchJob.id),
      )

      // Phase A - prepare every job. A prepare failure (deleted step, bad
      // params, db error) fails the whole batch with no retry, mirroring the
      // single-job worker's UnrecoverableError catch. This runs before any
      // write, so it is safe to throw here (all-or-none, see plan).
      const prepared = await Promise.all(
        batchJobs.map((batchJob, index) =>
          prepareActionExecution({ ...batchJob.data, jobId: jobIds[index] }),
        ),
      ).catch((err) => {
        throw new UnrecoverableError(err.message || 'Action failed to execute')
      })

      const action = prepared[0].actionCommand
      if (!action?.runBatch) {
        // A job landed on the batch queue for an action that does not implement
        // runBatch - a routing/config bug. Fail without retry.
        throw new UnrecoverableError(
          `Action ${prepared[0].step.appKey}/${prepared[0].step.key} does not implement runBatch`,
        )
      }

      // Pair each prepared job with its job id so the per-job finalize loops
      // below iterate one zipped list instead of two parallel arrays.
      const preparedJobs = prepared.map((preparedJob, index) => ({
        preparedJob,
        jobId: jobIds[index],
      }))

      // Acquire the per-file lock for the whole batch. Every job shares one
      // `${fileId}::${tableId}` group, so one lock key (from the app queue's
      // getLockKey) covers the batch. Taken BEFORE any execution-step insert: on
      // contention the whole batch is re-queued onto its group (no attempt
      // consumed, no failure steps recorded). Released in withLock's `finally`
      // after the write + bookkeeping.
      const lockKey = await resolveLockKey(prepared[0].$)

      return withLock(
        lockKey,
        async () => {
          // The single throw/retry point: one multi-row write for the whole batch.
          let runBatchError: unknown = null
          const runStart = Date.now()
          try {
            await action.runBatch(prepared.map(($job) => ({ $: $job.$ })))
          } catch (error) {
            runBatchError = error
          }
          const runMs = Date.now() - runStart

          // Failure path: the write did NOT commit. Record a failure step for
          // every job and patch each for-each iteration slot to 'failure' (else
          // the for-each hangs forever), THEN throw exactly once so the whole
          // batch retries per `attempts`. Because no rows were written, retrying
          // is safe.
          if (runBatchError) {
            span?.addTags({
              'batch.outcome': 'failed',
              'batch.run_ms': runMs,
            })

            let errorDetails: ExecutionStep['errorDetails'] = null
            for (const { preparedJob, jobId } of preparedJobs) {
              setActionOutputError(preparedJob.$, runBatchError)
              const executionStep = await recordExecutionStep({
                prepared: preparedJob,
                runResult: {},
                executionError: runBatchError,
                jobId,
              })
              errorDetails = executionStep.errorDetails

              if (preparedJob.metadata.iteration) {
                await ExecutionStep.patchIterationStatus(
                  preparedJob.execution.id,
                  preparedJob.metadata.iteration,
                  'failure',
                )
              }
            }

            return handleFailedStepAndThrow({
              errorDetails,
              executionError: runBatchError,
              context: {
                // The batch queue is not queue-delayable; createTableRow only
                // emits step/group delays. Pass the batch container job for
                // rate-limit / group classification.
                isQueueDelayable: false,
                span,
                worker,
                job,
              },
            })
          }

          // Success path: rows are committed. NOTHING below may throw out of the
          // processor (a throw re-runs runBatch -> duplicate rows), so every
          // job's bookkeeping (record step + resolve next + advance) is wrapped
          // in catch-log-continue. A bookkeeping failure stalls that one
          // execution.
          span?.addTags({
            'batch.outcome': 'success',
            'batch.run_ms': runMs,
          })

          for (const { preparedJob, jobId } of preparedJobs) {
            try {
              const executionStep = await recordExecutionStep({
                prepared: preparedJob,
                runResult: {},
                executionError: null,
                jobId,
              })
              const nextStep = await resolveNextStep({
                prepared: preparedJob,
                runResult: {},
              })
              await advanceAfterStep({
                processResult: {
                  flowId: preparedJob.flow.id,
                  executionId: preparedJob.execution.id,
                  nextStep,
                  executionStep,
                  nextStepMetadata: { ...preparedJob.metadata },
                  executionError: null,
                },
                currStep: preparedJob.step,
                context: {
                  isQueueDelayable: false,
                  span,
                  worker,
                  job,
                },
              })
            } catch (err) {
              logger.error(
                'Failed to finalize batched action job; execution may stall',
                {
                  err,
                  jobId,
                  flowId: preparedJob.flow.id,
                  executionId: preparedJob.execution.id,
                  stepId: preparedJob.step.id,
                },
              )
            }
          }
        },
        {
          span,
          onContention: async () => {
            span?.addTags({ 'lock.requeued': true })
            // RateLimitError-based re-queue does NOT work for a batch: bullmq-pro's
            // `moveToWait` isn't batch-aware, so the synthetic container would move
            // its fake id to wait and STRAND the member jobs in `active`. Instead
            // re-queue WITHOUT consuming an attempt by moving each member to
            // `delayed` ourselves: `moveToDelayed` uses skipAttempt (so attemptsMade
            // is untouched) and the pro Lua decrements the group's concurrency (so
            // the group isn't wedged). Members share the container's lock token.
            // Then empty the synthetic container so its normal completion is a
            // no-op for members and bullmq fetches the next batch. Done BEFORE any
            // execution step is recorded -> no spurious failure step, and because
            // no attempt is burned, sustained contention can retry unbounded (the
            // lock holder always finishes or its TTL expires, so a contender always
            // eventually wins). withLock's short up-front acquire retry already
            // absorbs brief contention without re-queueing; this only fires on
            // sustained contention.
            const requeueAt = Date.now() + fileLockRequeueDelayMs()
            await Promise.all(
              job
                .getBatch()
                .map((member) => member.moveToDelayed(requeueAt, job.token)),
            )
            job.setBatch([])
          },
        },
      )
    }),
    workerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
