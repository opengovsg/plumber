import { APICallError, RetryError } from 'ai'

// IMPORTANT: never log the model error itself. Its request body holds the user's prompt.
export function getModelErrorLogFields(error: unknown) {
  const apiCallError = RetryError.isInstance(error) ? error.lastError : error

  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    statusCode: APICallError.isInstance(apiCallError)
      ? apiCallError.statusCode
      : undefined,
  }
}
