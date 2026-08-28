import { describe, expect, it } from 'vitest'

import { buildSupportFormUrl } from './build-support-form-url'

describe('buildSupportFormUrl', () => {
  it('appends the chat ID as a pre-filled field when provided', () => {
    expect(buildSupportFormUrl('123e4567-e89b-12d3-a456-426614174000')).toBe(
      'TODO_SUPPORT_FORM_BASE_URL?TODO_SUPPORT_FORM_CHAT_ID_FIELD=123e4567-e89b-12d3-a456-426614174000',
    )
  })

  it('returns the bare form URL when chatId is empty', () => {
    expect(buildSupportFormUrl('')).toBe('TODO_SUPPORT_FORM_BASE_URL')
  })
})
