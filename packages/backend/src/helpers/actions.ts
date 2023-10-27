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
const CONNECTIVITY_ERROR_SIGNS = ['ETIMEDOUT', 'ECONNRESET']
const CONNECTIVITY_STATUS_CODE = [504]

export function handleErrorAndThrow(
  errorDetails: IJSONObject,
  // This is thrown from app.run, which _in theory_ can be anything.
  executionError: unknown,
): never {
  // Retry if we get a reasonable Retry-After header.
  // Note that we will only retry up to our max retry limit; this limit is
  // enforced by BullMQ and not this function).
  if (executionError && executionError instanceof HttpError) {
    const retryAfter = parseRetryAfter(
      executionError.response.headers['retry-after'],
    )

    if (retryAfter !== null) {
      throw retryAfter <= RETRY_AFTER_LIMIT_SECONDS
        ? new RetriableError({
            error: errorDetails,
            delay: retryAfter,
          })
        : new UnrecoverableError(JSON.stringify(errorDetails))
    }
  }

  //
  // Other remaining retriable edge cases....
  //
  const errorVariable = get(errorDetails, 'details.error', '') as unknown
  const errorString =
    typeof errorVariable === 'string'
      ? errorVariable
      : JSON.stringify(errorVariable)

  const statusCode = Number(get(errorDetails, 'status', 0))
  if (!errorString && !statusCode) {
    throw new UnrecoverableError(JSON.stringify(errorDetails))
  }

  // Certain connectivity errors can be retried.
  const isConnectivityIssue =
    CONNECTIVITY_ERROR_SIGNS.some((errorSign) =>
      errorString.includes(errorSign),
    ) || CONNECTIVITY_STATUS_CODE.includes(statusCode)
  if (isConnectivityIssue) {
    throw new RetriableError({
      error: errorDetails,
      delay: null,
    })
  }

  // All other errors cannot be retried.
  throw new UnrecoverableError(JSON.stringify(errorDetails))
}
