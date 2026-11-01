import { StepErrorKind } from '@plumber/types'
import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'

// Plumber owns the gateway key and the request rate.
const INTERNAL_STATUS_CODES = [401, 403, 429]

export function getModelErrorKind(error: unknown): StepErrorKind {
  const apiCallError = RetryError.isInstance(error) ? error.lastError : error

  if (APICallError.isInstance(apiCallError)) {
    return INTERNAL_STATUS_CODES.includes(apiCallError.statusCode ?? 0)
      ? 'internal'
      : 'third-party'
  }

  if (
    RetryError.isInstance(error) ||
    NoObjectGeneratedError.isInstance(error)
  ) {
    return 'third-party'
  }

  return 'internal'
}
