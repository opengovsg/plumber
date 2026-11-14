import { StepErrorKind } from '@plumber/types'
import { APICallError, JSONParseError, RetryError } from 'ai'

export function getModelErrorKind(error: unknown): StepErrorKind {
  // Earlier retryable attempts must not mask a Plumber fault in the last attempt.
  if (RetryError.isInstance(error)) {
    return getModelErrorKind(error.lastError)
  }

  if (APICallError.isInstance(error)) {
    // A garbled body is a provider fault. A body that misses the SDK schema means a format change.
    if (JSONParseError.isInstance(error.cause)) {
      return 'third-party'
    }

    // Plumber owns the Bedrock credentials and builds every request, so a 4xx is our bug.
    const { statusCode } = error
    return statusCode !== undefined && statusCode < 500
      ? 'internal'
      : 'third-party'
  }

  return 'internal'
}
