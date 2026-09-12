import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import { UserFacingError } from '@/errors/user-facing-error'

import {
  AI_CHAT_ABORTED_ERROR_MESSAGE,
  AI_CHAT_GENERIC_ERROR_MESSAGE,
  getAiChatErrorMessage,
} from '../get-ai-chat-error-message'

describe('getAiChatErrorMessage', () => {
  it('preserves UserFacingError messages', () => {
    expect(getAiChatErrorMessage(new UserFacingError('Step not found'))).toBe(
      'Step not found',
    )
  })

  it('preserves BadUserInputError messages', () => {
    expect(
      getAiChatErrorMessage(
        new BadUserInputError('Unable to generate the workflow.'),
      ),
    ).toBe('Unable to generate the workflow.')
  })

  it('returns empty string for AbortError so the client can skip the toast', () => {
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    expect(getAiChatErrorMessage(error)).toBe(AI_CHAT_ABORTED_ERROR_MESSAGE)
  })

  it('maps APICallError 429 to a busy message', () => {
    const error = new APICallError({
      message: 'Rate limited',
      url: 'https://engine.pair.gov.sg',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    })
    expect(getAiChatErrorMessage(error)).toBe(
      'The AI service is temporarily busy. Please try again in a moment.',
    )
  })

  it('maps APICallError 5xx to an unavailable message', () => {
    const error = new APICallError({
      message: 'Internal error',
      url: 'https://engine.pair.gov.sg',
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    })
    expect(getAiChatErrorMessage(error)).toBe(
      'The AI service is temporarily unavailable. Please try again.',
    )
  })

  it('maps litellm body on APICallError when status is not distinctive', () => {
    const error = new APICallError({
      message: 'Bad Request',
      url: 'https://engine.pair.gov.sg',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
      data: {
        error: {
          message:
            'litellm.ContextWindowExceededError: Context length exceeded for model',
        },
      },
    })
    expect(getAiChatErrorMessage(error)).toBe(
      'Your conversation is too long for the AI to process. Please start a new chat.',
    )
  })

  it('does not forward raw litellm strings', () => {
    const litellmDump =
      "litellm.exceptions.RateLimitError: RateLimitError: OpenAIException - Error code: 429 - {'error': {'message': 'Rate limit reached'}}"
    expect(getAiChatErrorMessage(new Error(litellmDump))).toBe(
      'The AI service is temporarily busy. Please try again in a moment.',
    )
    expect(getAiChatErrorMessage(litellmDump)).toBe(
      'The AI service is temporarily busy. Please try again in a moment.',
    )
  })

  it('returns the generic message for unknown errors', () => {
    expect(getAiChatErrorMessage(new Error('ECONNREFUSED 127.0.0.1'))).toBe(
      AI_CHAT_GENERIC_ERROR_MESSAGE,
    )
    expect(getAiChatErrorMessage(null)).toBe(AI_CHAT_GENERIC_ERROR_MESSAGE)
    expect(getAiChatErrorMessage({ weird: true })).toBe(
      AI_CHAT_GENERIC_ERROR_MESSAGE,
    )
  })
})
