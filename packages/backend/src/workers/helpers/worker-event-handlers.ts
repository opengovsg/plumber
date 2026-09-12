import type { IActionJobData } from '@plumber/types'

import { type JobPro, type WorkerPro } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'

import { handleFailedJob } from './handle-failed-job'

/**
 * A BullMQ Pro batch surfaces a synthetic container job whose `data` is empty -
 * its real jobs (each with its own flow/execution) live in `getBatch()`. So
 * `job.data.flowId` is `undefined` for a batch; derive the distinct member flow
 * id(s) instead (joined, since a batch may mix different flows that target the
 * same file/table). A single (non-batch) job has no batch and falls back to its
 * own `flowId`. The batch's `job.id` is the comma-joined member ids (e.g.
 * `19,20,21`), so a multi-id JOB ID in these logs is itself the tell that jobs
 * coalesced into one batch.
 */
function resolveFlowId(job: JobPro<IActionJobData>): string | undefined {
  const batch = job.getBatch?.()
  if (!batch?.length) {
    return job.data.flowId
  }
  return [...new Set(batch.map((member) => member.data.flowId))].join(',')
}

/**
 * Attaches standard event listeners to a worker for logging and error handling.
 * Used by both action workers and sub-trigger workers.
 */
export function registerWorkerEventHandlers(
  worker: WorkerPro<IActionJobData>,
  queueName: string,
): void {
  worker.on('active', (job) => {
    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${resolveFlowId(
        job,
      )} has started!`,
      {
        queueName,
        job: job.data,
        batchSize: job.getBatch?.()?.length,
        workerVersion: appConfig.version,
      },
    )
  })

  worker.on('completed', (job) => {
    // An empty batch array means the container was emptied by a file-lock
    // contention re-queue (requeueBatchOnContention's setBatch([])); its
    // 'completed' event is a no-op for the members (moved to `delayed` and
    // already logged at the re-queue site). Skip the misleading "has completed!"
    // line - it would otherwise log `batchSize: 0` / `FLOW ID: undefined`. A
    // single job has no batch (`getBatch()` undefined) and a real batch is
    // non-empty, so both still log normally.
    const batch = job.getBatch?.()
    if (Array.isArray(batch) && batch.length === 0) {
      return
    }

    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${resolveFlowId(
        job,
      )} has completed!`,
      {
        queueName,
        job: job.data,
        batchSize: batch?.length,
        workerVersion: appConfig.version,
      },
    )
  })

  worker.on('failed', async (job, err) => {
    // BullMQ Pro batches surface a synthetic container job whose `data` is empty
    // (its real jobs - each with its own execution - live in getBatch()). Fan
    // out over the batch so every execution is resolved; single jobs have no
    // batch and fall back to themselves. Without this, a failed batch leaves all
    // its executions stuck at a null status (and sends no error email).
    //
    // NOTE: this fan-out only fires when the processor THREW (the whole batch
    // failed). Per-job `setAsFailed` members (the batch worker's partial-failure
    // path) emit no `failed` event, so their side-effects run inline in the
    // processor via `handleFailedJob` instead - see make-action-batch-worker.ts.
    const failedJobs = job.getBatch?.() ?? [job]

    // Sequentially, so the per-flow error-email de-dup (Redis) and the
    // idempotent execution status update behave exactly as they do for the
    // separate single jobs of a for-each today.
    for (const failedJob of failedJobs) {
      await handleFailedJob(failedJob, err, queueName)
    }
  })

  worker.on('ready', () => {
    logger.info(`[${queueName}] Worker is ready!`)
  })

  worker.on('closed', () => {
    logger.info(`[${queueName}] Worker is closed!`)
  })

  worker.on('error', (err) => {
    if (!err) {
      logger.error(`[${queueName}] Worker had undefined error`)
      return
    }
    // catch-all just in case any errors bubble up and potentially crash the worker task
    logger.error(`[${queueName}] Worker errored with ${err.message}`, {
      err: err.stack,
      queueName,
    })
  })
}
