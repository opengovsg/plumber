import type { IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { get } from 'lodash'

import apps from '@/apps'
import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import Step from '@/models/step'

export function doesActionProcessFiles(step: Step): boolean {
  if (!apps[step.appKey]) {
    return false
  }
  const action = apps[step.appKey].actions.find((a) => a.key === step.key)
  if (!action || !action.doesFileProcessing) {
    return false
  }

  return action.doesFileProcessing(step)
}

/**
 * Helper to parse Retry-After header, which we receive as seconds to delay, or Date after which to retry.
 *
 * @returns Non-negative (>= 0) number of milliseconds to wait before retrying,
 * or null on failure (badly formatted value, or retry-after in the past)
 */
function parseRetryAfterToMs(
  rawHeaderValue: string | null | undefined,
): number | null {
  if (!rawHeaderValue) {
    return null
  }

  // Try parsing as seconds.
  let retryAfter = Number(rawHeaderValue)
  if (!isNaN(retryAfter)) {
    return retryAfter >= 0 ? retryAfter * 1000 : null
  }

  // Try parsing as date.
  retryAfter = new Date(rawHeaderValue).getTime()
  if (isNaN(retryAfter)) {
    return null
  }

  retryAfter = retryAfter - Date.now()
  return retryAfter >= 0 ? retryAfter : null
}

const RETRY_AFTER_LIMIT_MS = 12 * 60 * 60 * 1000 // 12 hours
const RETRIABLE_ERROR_SUBSTRINGS = ['ETIMEDOUT', 'ECONNRESET']
const RETRIABLE_STATUS_CODES = [
  504,
  429, // Some 429s may not have Retry-After
]

export function handleErrorAndThrow(
  errorDetails: IJSONObject,
  // This is thrown from app.run, which _in theory_ can be anything.
  executionError: unknown,
): never {
  // Edge case as some actions throw StepError now, but others don't.
  if (executionError instanceof StepError) {
    executionError = executionError.cause
  }

  // We passthrough RetriableErrors thrown directly by the action.
  if (executionError instanceof RetriableError) {
    throw executionError
  }

  // Otherwise... we only support automatically retrying HTTP errors for now.
  if (!(executionError instanceof HttpError)) {
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  }

  // Handle reasonable Retry-After responses.
  const retryAfterMs = parseRetryAfterToMs(
    executionError.response?.headers?.['retry-after'],
  )

  if (retryAfterMs !== null) {
    if (retryAfterMs <= RETRY_AFTER_LIMIT_MS) {
      throw new RetriableError({
        error: errorDetails,
        delayInMs: retryAfterMs,
      })
    }
    throw new UnrecoverableError(`Retry-After (${retryAfterMs}ms) is too long!`)
  }

  // Handle retriable status codes
  if (RETRIABLE_STATUS_CODES.includes(executionError.response?.status)) {
    throw new RetriableError({
      error: errorDetails,
      delayInMs: 'default',
    })
  }

  // Handle retriable errors (identified by message substring)
  const errorString = JSON.stringify(get(errorDetails, 'details.error', ''))
  for (const errorSubstring of RETRIABLE_ERROR_SUBSTRINGS) {
    if (errorString.includes(errorSubstring)) {
      throw new RetriableError({
        error: errorDetails,
        delayInMs: 'default',
      })
    }
  }

  // All other errors cannot be retried.
  throw new UnrecoverableError(JSON.stringify(errorDetails))
}
