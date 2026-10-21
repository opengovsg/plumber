import { describe, expect, it } from 'vitest'

import {
  AI_CHAT_GENERIC_TOAST_MESSAGE,
  getChatToastMessage,
} from './getChatToastMessage'

describe('getChatToastMessage', () => {
  it('returns empty string for blank messages so the toast can be skipped', () => {
    expect(getChatToastMessage(new Error(''))).toBe('')
    expect(getChatToastMessage(new Error('   '))).toBe('')
  })

  it('extracts the error field from JSON HTTP bodies', () => {
    expect(
      getChatToastMessage(
        new Error(
          JSON.stringify({
            error: 'Invalid request body',
            details: [{ path: ['messages'] }],
          }),
        ),
      ),
    ).toBe('Invalid request body')

    expect(
      getChatToastMessage(
        new Error(
          JSON.stringify({
            error: 'You do not have permissions to use AI Builder!',
          }),
        ),
      ),
    ).toBe('You do not have permissions to use AI Builder!')
  })

  it('falls back to the generic message for JSON without a usable error field', () => {
    expect(
      getChatToastMessage(new Error(JSON.stringify({ details: ['x'] }))),
    ).toBe(AI_CHAT_GENERIC_TOAST_MESSAGE)
    expect(getChatToastMessage(new Error('{not-json'))).toBe(
      AI_CHAT_GENERIC_TOAST_MESSAGE,
    )
  })

  it('passes through already-sanitized stream error messages', () => {
    expect(
      getChatToastMessage(
        new Error(
          'The AI service is temporarily busy. Please try again in a moment.',
        ),
      ),
    ).toBe('The AI service is temporarily busy. Please try again in a moment.')
  })
})
