import type { IActionJobData } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { getStepErrorKind } from '@/errors/step'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'
import {
  isErrorEmailAlreadySent,
  sendErrorEmail,
} from '@/helpers/generate-error-email'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'

/**
 * Monitors read this log rather than spans, because logs are not sampled.
 */
async function logActionJobFailure(
  failedJob: JobPro<IActionJobData>,
  err: Error,
): Promise<void> {
  const { flowId, stepId } = failedJob.data

  let appKey: string | undefined
  try {
    appKey = (await Step.query().findById(stepId))?.appKey
  } catch {
    // A missing appKey must not stop the execution from being marked failed.
  }

  logger.info(`Action job failed for flow ID: ${flowId}`, {
    event: 'action-job-failed',
    kind: getStepErrorKind(err.cause),
    flowId,
    appKey,
  })
}

/**
 * Post-failure side-effects for a single (non-batch) action job: mark its
 * execution failed and send the (de-duped) error email.
 *
 * Shared by two callers:
 *  - the worker `failed`-event fan-out ({@link registerWorkerEventHandlers}),
 *    which calls it behind a `willRetryJob` guard so a job that will be retried
 *    is skipped (behavior unchanged from when this lived inline there); and
 *  - the batch processor's inline partial-failure path, which calls it with an
 *    `UnrecoverableError` so the guard is a no-op and the side-effects always
 *    run. A `setAsFailed` batch member never emits a `failed` event (bullmq-pro
 *    moves it straight to the failed set on the resolve path), so its
 *    side-effects MUST be run inline rather than via the fan-out.
 */
export async function handleFailedJob(
  failedJob: JobPro<IActionJobData>,
  err: Error,
  queueName: string,
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

  await logActionJobFailure(failedJob, err)

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
