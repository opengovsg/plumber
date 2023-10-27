import type { IJSONObject } from '@plumber/types'

import { UnrecoverableError } from 'bullmq'
import { memoize } from 'lodash'

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
 * Helper to parse Retry-After header, which can can be integer seconds or Date.
 *
 * @returns Non-negative (>= 0) number of seconds to wait before retrying, or
 * null on failure (badly formatted value, or retry-after in the past)
 */
function parseRetryAfter(
  rawHeaderValue: string | null | undefined,
): number | null {
  if (!rawHeaderValue) {
    return null
  }

  // Try parsing as seconds.
  let retryAfter = parseInt(rawHeaderValue)
  if (!isNaN(retryAfter)) {
    return retryAfter >= 0 ? retryAfter : null
  }

  // Try parsing as date.
  retryAfter = new Date(rawHeaderValue).getTime()
  if (isNaN(retryAfter)) {
    return null
  }

  retryAfter = retryAfter - Date.now()
  return retryAfter >= 0 ? retryAfter : null
}

const RETRY_AFTER_LIMIT_SECONDS = 10000
const RETRIABLE_AXIOS_ERROR_CODES = ['ETIMEDOUT', 'ECONNRESET']
const RETRIABLE_STATUS_CODES = [504]

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
  const retryAfter = parseRetryAfter(
    executionError.response?.headers?.['retry-after'],
  )

  if (retryAfter !== null) {
    if (retryAfter <= RETRY_AFTER_LIMIT_SECONDS) {
      throw new RetriableError({
        error: errorDetails,
        delay: retryAfter,
      })
    }
    throw new UnrecoverableError(`Retry-After (${retryAfter}) is too long!`)
  }

  // Handle retriable status codes
  if (RETRIABLE_STATUS_CODES.includes(executionError.response?.status)) {
    throw new RetriableError({
      error: errorDetails,
      delay: 'default',
    })
  }

  // Handle retriable Axios error codes
  if (RETRIABLE_AXIOS_ERROR_CODES.includes(executionError.errorCode)) {
    throw new RetriableError({
      error: errorDetails,
      delay: 'default',
    })
  }

  // All other errors cannot be retried.
  throw new UnrecoverableError(JSON.stringify(errorDetails))
}
