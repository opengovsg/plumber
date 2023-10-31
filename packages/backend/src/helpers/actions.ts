import type { IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { get, memoize } from 'lodash'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import App from '@/models/app'

function getCompositeKey(appKey: string, actionKey: string): string {
  return `${appKey}:${actionKey}`
}

// Memoize as we can't use top-level awaits yet.
const getFileProcessingActions = memoize(
  async (): Promise<ReadonlySet<string>> => {
    const result = new Set<string>()
    const apps = await App.getAllAppsWithFunctions()

    for (const app of apps) {
      for (const action of app.actions ?? []) {
        if (action.doesFileProcessing ?? false) {
          result.add(getCompositeKey(app.key, action.key))
        }
      }
    }

    return result
  },
)

export async function doesActionProcessFiles(
  appKey: string,
  actionKey: string,
): Promise<boolean> {
  if (!appKey || !actionKey) {
    return false
  }

  return (await getFileProcessingActions()).has(
    getCompositeKey(appKey, actionKey),
  )
}

/**
 * Helper to parse Retry-After header, which we receive as seconds or Date.
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
  // Only support retrying HTTP errors for now.
  if (!executionError || !(executionError instanceof HttpError)) {
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
