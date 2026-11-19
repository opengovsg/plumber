import { APICallError, RetryError } from 'ai'
import { describe, expect, it } from 'vitest'

import { getModelErrorLogFields } from '@/apps/pair/common/get-model-error-log-fields'

function makeApiCallError(statusCode?: number): APICallError {
  return new APICallError({
    message: 'Output blocked by content filtering policy',
    url: 'https://bedrock-runtime.ap-southeast-1.amazonaws.com/model/claude/invoke',
    requestBodyValues: { messages: [{ role: 'user', content: 'secret' }] },
    statusCode,
  })
}

describe('getModelErrorLogFields', () => {
  it('returns the name, message and status of an API call error', () => {
    expect(getModelErrorLogFields(makeApiCallError(400))).toEqual({
      errorName: 'AI_APICallError',
      errorMessage: 'Output blocked by content filtering policy',
      statusCode: 400,
    })
  })

  it('omits the request body', () => {
    expect(
      JSON.stringify(getModelErrorLogFields(makeApiCallError(400))),
    ).not.toContain('secret')
  })

  it('returns the status of the last error in a retry error', () => {
    const error = new RetryError({
      message: 'Failed after 3 attempts',
      reason: 'maxRetriesExceeded',
      errors: [makeApiCallError(503)],
    })

    expect(getModelErrorLogFields(error)).toEqual({
      errorName: 'AI_RetryError',
      errorMessage: 'Failed after 3 attempts',
      statusCode: 503,
    })
  })

  it('returns no status for other errors', () => {
    expect(getModelErrorLogFields(new Error('boom'))).toEqual({
      errorName: 'Error',
      errorMessage: 'boom',
      statusCode: undefined,
    })
  })

  it('handles a thrown non-error value', () => {
    expect(getModelErrorLogFields('boom')).toEqual({
      errorName: 'string',
      errorMessage: 'boom',
      statusCode: undefined,
    })
  })
})
