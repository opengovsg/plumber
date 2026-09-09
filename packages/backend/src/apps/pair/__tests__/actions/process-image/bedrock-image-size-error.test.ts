import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { isBedrockImageTooLargeError } from '../../../actions/process-image/bedrock-image-size-error'

function makeApiCallError(
  message: string,
  { data }: { data?: unknown } = {},
): APICallError {
  return new APICallError({
    message,
    url: 'https://litellm.example.com/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify(data ?? { error: { message } }),
    data: data ?? { error: { message } },
  })
}

describe('isBedrockImageTooLargeError', () => {
  it('returns true when the parsed error data contains the Bedrock image size message', () => {
    const error = makeApiCallError('unused top-level message', {
      data: {
        error: {
          message: 'image exceeds 5 MB maximum: 5899164 bytes > 5242880 bytes',
        },
      },
    })

    expect(isBedrockImageTooLargeError(error)).toBe(true)
  })

  it('returns true when the message is buried in noisy litellm fallback details', () => {
    const message = [
      'litellm.BadRequestError: BedrockException - {"message":"Malformed input request"}',
      'Received Model Group=bedrock-nova',
      'Available Model Group Fallbacks=[bedrock-claude]',
      'Error doing the fallback: litellm.BadRequestError: BedrockException - ' +
        '{"message":"image exceeds 5 MB maximum: 5899164 bytes > 5242880 bytes"}',
    ].join('\n')
    const error = makeApiCallError(message)

    expect(isBedrockImageTooLargeError(error)).toBe(true)
  })

  it('falls back to error.message when error.data does not match the expected shape', () => {
    const error = new APICallError({
      message: 'image exceeds 5 MB maximum: 5899164 bytes > 5242880 bytes',
      url: 'https://litellm.example.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 400,
    })

    expect(isBedrockImageTooLargeError(error)).toBe(true)
  })

  it('returns false for unrelated API errors', () => {
    const error = makeApiCallError('litellm.RateLimitError: rate limited')

    expect(isBedrockImageTooLargeError(error)).toBe(false)
  })

  it('returns false for non-APICallError errors', () => {
    expect(
      isBedrockImageTooLargeError(
        new Error('image exceeds 5 MB maximum: 100 bytes > 50 bytes'),
      ),
    ).toBe(false)
    expect(isBedrockImageTooLargeError('some string')).toBe(false)
    expect(isBedrockImageTooLargeError(null)).toBe(false)
  })
})
