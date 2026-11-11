import { StepErrorKind } from '@plumber/types'
import { APICallError, RetryError } from 'ai'

export function getModelErrorKind(error: unknown): StepErrorKind {
  const apiCallError = RetryError.isInstance(error) ? error.lastError : error

  if (APICallError.isInstance(apiCallError)) {
    // Plumber owns the Bedrock credentials and builds every request, so a 4xx is our bug.
    const { statusCode } = apiCallError
    return statusCode !== undefined && statusCode < 500
      ? 'internal'
      : 'third-party'
  }

  if (RetryError.isInstance(error)) {
    return 'third-party'
  }

  return 'internal'
}
