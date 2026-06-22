import type { IActionJobData } from '@plumber/types'

import { UnrecoverableError, type WorkerPro } from '@taskforcesh/bullmq-pro'

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
 * Records a stalled job (lock expired and the job was moved back to be
 * reprocessed). Logs a structured warning so Datadog can derive a log-based
 * metric (filter `event:job-stalled`, tag by `queueName`). Shared across all
 * workers - the `stalled` event only provides the job ID.
 */
export function recordStalledJob(queueName: string, jobId: string): void {
  logger.warn(`[${queueName}] JOB ID: ${jobId} has stalled`, {
    queueName,
    jobId,
    event: 'job-stalled',
    workerVersion: appConfig.version,
  })
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
    const { flowId, executionId } = job.data

    logger.error(
      `[${queueName}] JOB ID: ${job.id} - FLOW ID: ${flowId} has failed to start with ${err.message}`,
      {
        err,
        queueName,
        job: job.data,
        attemptsMade: job.attemptsMade,
        attemptsStarted: job.attemptsStarted,
        workerVersion: appConfig.version,
      },
    )

    // The job will be retried if:
    // 1. The error is not an UnrecoverableError, and
    // 2. We haven't exceeded the maximum number of retry attempts
    const willRetryJob =
      !(err instanceof UnrecoverableError) && // Not an unrecoverable error
      job.attemptsMade < MAXIMUM_JOB_ATTEMPTS // Haven't reached max attempts

    // No further post-processing needed if we're retrying.
    if (willRetryJob) {
      return
    }

    try {
      await Execution.setStatus(executionId, 'failure')

      const flow = await Flow.query()
        .findById(job.data.flowId)
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
        errorDetails: { ...emailErrorDetails, ...job.data },
      })
    } catch (err) {
      logger.error(
        `Error while running onFailed callback for execution ID ${executionId}`,
        {
          event: 'onfailed-callback-failed',
          err,
          jobData: job.data,
        },
      )
    }
  })

  worker.on('stalled', (jobId) => {
    recordStalledJob(queueName, jobId)
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
