import type { IActionJobData } from '@plumber/types'

import { type JobPro, WorkerPro } from '@taskforcesh/bullmq-pro'
import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { type Span } from 'dd-trace'
import get from 'lodash.get'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import ExecutionStep from '@/models/execution-step'

import { MAXIMUM_JOB_ATTEMPTS } from '../default-job-configuration'
import { parseRetryAfterToMs } from '../parse-retry-after-to-ms'

function handleRetriableError(
  executionError: RetriableError,
  context: HandleFailedStepAndThrowParams['context'],
): never {
  const { delayType, delayInMs } = executionError
  const { worker, job, isQueueDelayable } = context

  switch (delayType) {
    case 'queue':
      if (isQueueDelayable) {
        worker.rateLimit(delayInMs)
        throw WorkerPro.RateLimitError()
      }

      // This shouldn't happen (most likely, there is some re-used code in
      // actions).
      //
      // We pass this through to our worker's retry handler
      // (exponentialBackoffWithJitter), which will log it as an error and fire
      // off a small alert.
      throw executionError
    case 'group': {
      const groupId = job.opts?.group?.id
      if (groupId) {
        worker.rateLimitGroup(job, delayInMs)
        throw WorkerPro.RateLimitError()
      }

      // Like above, this _also_ shouldn't happen and we will pass it to our
      // retry handler for logging.
      throw executionError
    }
    case 'step':
      // Finally, OK to pass this through to our worker's retry handler
      throw executionError
  }
}

const RETRY_AFTER_LIMIT_MS = 12 * 60 * 60 * 1000 // 12 hours
const RETRIABLE_ERROR_SUBSTRINGS = ['ETIMEDOUT', 'ECONNRESET']
const RETRIABLE_STATUS_CODES = [
  504,
  429, // Some 429s may not have Retry-After
]

function handleHttpError(
  executionError: HttpError,
  errorDetails: HandleFailedStepAndThrowParams['errorDetails'],
): never {
  // Handle reasonable Retry-After responses.
  const retryAfterMs = parseRetryAfterToMs(
    executionError.response?.headers?.['retry-after'],
  )

  if (retryAfterMs !== null) {
    if (retryAfterMs <= RETRY_AFTER_LIMIT_MS) {
      throw new RetriableError({
        error: errorDetails,
        delayInMs: retryAfterMs,
        delayType: 'step',
      })
    }
    throw new UnrecoverableError(`Retry-After (${retryAfterMs}ms) is too long!`)
  }

  // Handle retriable status codes
  if (RETRIABLE_STATUS_CODES.includes(executionError.response?.status)) {
    throw new RetriableError({
      error: errorDetails,
      delayInMs: 'default',
      delayType: 'step',
    })
  }

  // Handle retriable errors (identified by message substring)
  const errorString = JSON.stringify(get(errorDetails, 'details.error', ''))
  for (const errorSubstring of RETRIABLE_ERROR_SUBSTRINGS) {
    if (errorString.includes(errorSubstring)) {
      throw new RetriableError({
        error: errorDetails,
        delayInMs: 'default',
        delayType: 'step',
      })
    }
  }

  // All other HTTP errors are un-retriable
  throw new UnrecoverableError(JSON.stringify(errorDetails))
}

interface HandleFailedStepAndThrowParams {
  errorDetails: ExecutionStep['errorDetails']

  // This is thrown from app.run, which _in theory_ can be anything.
  executionError: unknown

  context: {
    isQueueDelayable: boolean
    span: Span
    worker: WorkerPro<IActionJobData>
    job: JobPro<IActionJobData>
  }
}

export function handleFailedStepAndThrow(
  params: HandleFailedStepAndThrowParams,
): never {
  let { executionError } = params
  const { errorDetails, context } = params
  const { span, job } = context

  // Edge case as some actions throw StepError now, but others don't.
  if (executionError instanceof StepError) {
    executionError = executionError.cause
  }

  // Inspect the error / failure reason, and determine if we can retry the step.
  try {
    if (executionError instanceof RetriableError) {
      return handleRetriableError(executionError, context)
    }
    if (executionError instanceof HttpError) {
      return handleHttpError(executionError, errorDetails)
    }

    // All other errors cannot be retried.
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  } catch (finalError) {
    // Update span and execution status as necessary.
    const isRetriable =
      !(finalError instanceof UnrecoverableError) &&
      // -1 is needed because BullMQ only increments attemptsMade _after_ the
      // job processor finishes, but we're currently still inside the job
      // processor.
      job.attemptsMade < MAXIMUM_JOB_ATTEMPTS - 1

    span?.addTags({
      willRetry: isRetriable ? 'true' : 'false',
    })

    throw finalError
  }
}
