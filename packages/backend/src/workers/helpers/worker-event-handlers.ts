import type { IActionJobData } from '@plumber/types'

import {
  type JobPro,
  UnrecoverableError,
  type WorkerPro,
} from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'
import {
  isErrorEmailAlreadySent,
  sendErrorEmail,
} from '@/helpers/generate-error-email'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import Flow from '@/models/flow'

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

  // Post-failure processing for a single (non-batch) job: mark its execution
  // failed and send the error email. Factored out so batch jobs can reuse it.
  async function handleFailedJob(
    failedJob: JobPro<IActionJobData>,
    err: Error,
  ): Promise<void> {
    const { flowId, executionId } = failedJob.data

    logger.error(
      `[${queueName}] JOB ID: ${failedJob.id} - FLOW ID: ${flowId} has failed to start with ${err.message}`,
      {
        err,
        queueName,
        job: failedJob.data,
        attemptsMade: failedJob.attemptsMade,
        attemptsStarted: failedJob.attemptsStarted,
        workerVersion: appConfig.version,
      },
    )

    // The job will be retried if:
    // 1. The error is not an UnrecoverableError, and
    // 2. We haven't exceeded the maximum number of retry attempts
    const willRetryJob =
      !(err instanceof UnrecoverableError) && // Not an unrecoverable error
      failedJob.attemptsMade < MAXIMUM_JOB_ATTEMPTS // Haven't reached max attempts

    // No further post-processing needed if we're retrying.
    if (willRetryJob) {
      return
    }

    try {
      await Execution.setStatus(executionId, 'failure')

      const flow = await Flow.query()
        .findById(flowId)
        .withGraphFetched({
          user: true,
          collaborators: {
            user: true,
          },
        })
        .throwIfNotFound()

      const shouldAlwaysSendEmail =
        flow.config?.errorConfig?.notificationFrequency === 'always'

      // Don't check redis if notification frequency is always
      if (!shouldAlwaysSendEmail && (await isErrorEmailAlreadySent(flowId))) {
        return
      }

      const emailErrorDetails = await sendErrorEmail(flow)
      logger.info(`Sent error email for execution ID: ${executionId}`, {
        errorDetails: { ...emailErrorDetails, ...failedJob.data },
      })
    } catch (err) {
      logger.error(
        `Error while running onFailed callback for execution ID ${executionId}`,
        {
          event: 'onfailed-callback-failed',
          err,
          jobData: failedJob.data,
        },
      )
    }
  }

  worker.on('failed', async (job, err) => {
    // BullMQ Pro batches surface a synthetic container job whose `data` is empty
    // (its real jobs - each with its own execution - live in getBatch()). Fan
    // out over the batch so every execution is resolved; single jobs have no
    // batch and fall back to themselves. Without this, a failed batch leaves all
    // its executions stuck at a null status (and sends no error email).
    const failedJobs = job.getBatch?.() ?? [job]

    // Sequentially, so the per-flow error-email de-dup (Redis) and the
    // idempotent execution status update behave exactly as they do for the
    // separate single jobs of a for-each today.
    for (const failedJob of failedJobs) {
      await handleFailedJob(failedJob, err)
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
