import type { IActionJobData } from '@plumber/types'

import { type WorkerPro } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'

import { handleFailedJob } from './handle-failed-job'

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
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has started!`,
      {
        queueName,
        job: job.data,
        workerVersion: appConfig.version,
      },
    )
  })

  worker.on('completed', (job) => {
    logger.info(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${job.data.flowId} has completed!`,
      {
        queueName,
        job: job.data,
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
