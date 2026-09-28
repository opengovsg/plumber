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
import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'
import ExecutionStep from '@/models/execution-step'
import { makeActionJobId } from '@/queues/action'
import {
  prepareActionExecution,
  recordExecutionStep,
  resolveNextStep,
  setActionOutputError,
} from '@/services/action'

import { advanceAfterStep } from './advance-after-step'
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
    // Throughput cap only - NOT relied on for write serialization (group
    // concurrency cannot guarantee one batch per group; the per-file Redis lock
    // does that - see the per-file lock phase).
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

      // The single throw/retry point: one multi-row write for the whole batch.
      let runBatchError: unknown = null
      const runStart = Date.now()
      try {
        await action.runBatch(prepared.map(($job) => ({ $: $job.$ })))
      } catch (error) {
        runBatchError = error
      }
      const runMs = Date.now() - runStart

      // Failure path: the write did NOT commit. Record a failure step for every
      // job and patch each for-each iteration slot to 'failure' (else the
      // for-each hangs forever), THEN throw exactly once so the whole batch
      // retries per `attempts`. Because no rows were written, retrying is safe.
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
            // The batch queue is not queue-delayable; createTableRow only emits
            // step/group delays. Pass the batch container job for rate-limit /
            // group classification.
            isQueueDelayable: false,
            span,
            worker,
            job,
          },
        })
      }

      // Success path: rows are committed. NOTHING below may throw out of the
      // processor (a throw re-runs runBatch -> duplicate rows), so every job's
      // bookkeeping (record step + resolve next + advance) is wrapped in
      // catch-log-continue. A bookkeeping failure stalls that one execution.
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
    }),
    workerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
