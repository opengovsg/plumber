import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'

import { getModelErrorKind } from '@/apps/pair/common/get-model-error-kind'

function makeApiCallError(statusCode?: number): APICallError {
  return new APICallError({
    message: 'Model error',
    url: 'https://bedrock-runtime.ap-southeast-1.amazonaws.com/model/claude/invoke',
    requestBodyValues: {},
    statusCode,
  })
}

function makeRetryError(lastError: unknown): RetryError {
  return new RetryError({
    message: 'Failed after 3 attempts',
    reason: 'maxRetriesExceeded',
    errors: [lastError],
  })
}

describe('getModelErrorKind', () => {
  it.each([400, 401, 403, 404, 429])(
    'returns internal for an API call error with status %i',
    (statusCode) => {
      expect(getModelErrorKind(makeApiCallError(statusCode))).toBe('internal')
    },
  )

  it.each([500, 503, 529])(
    'returns third-party for an API call error with status %i',
    (statusCode) => {
      expect(getModelErrorKind(makeApiCallError(statusCode))).toBe(
        'third-party',
      )
    },
  )

  it('returns third-party for a network error', () => {
    expect(getModelErrorKind(makeApiCallError(undefined))).toBe('third-party')
  })

  it('returns internal for a retry error whose last error is a 429', () => {
    expect(getModelErrorKind(makeRetryError(makeApiCallError(429)))).toBe(
      'internal',
    )
  })

  it('returns third-party for a retry error whose last error is a 503', () => {
    expect(getModelErrorKind(makeRetryError(makeApiCallError(503)))).toBe(
      'third-party',
    )
  })

  it('returns third-party for a retry error whose last error is not an API call error', () => {
    expect(getModelErrorKind(makeRetryError(new Error('boom')))).toBe(
      'third-party',
    )
  })

  it('returns third-party when the model output does not match the schema', () => {
    const error = new NoObjectGeneratedError({
      message: 'No object generated: response did not match schema.',
      response: { id: 'id', timestamp: new Date(), modelId: 'model' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finishReason: 'stop',
    })

    expect(getModelErrorKind(error)).toBe('third-party')
  })

  it('returns internal for an unknown error', () => {
    expect(getModelErrorKind(new Error('boom'))).toBe('internal')
  })
})
