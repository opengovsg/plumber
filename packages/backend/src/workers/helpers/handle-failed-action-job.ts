import { Job, UnrecoverableError } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'
import {
  isErrorEmailAlreadySent,
  sendErrorEmail,
} from '@/helpers/generate-error-email'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import Flow from '@/models/flow'

export const handleFailedActionJob = async (
  job: Job,
  queueName: string,
  err: Error,
) => {
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
      .withGraphFetched('user')
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
}
