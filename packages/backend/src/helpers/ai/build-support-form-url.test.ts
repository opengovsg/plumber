import { describe, expect, it } from 'vitest'

import { buildSupportFormUrl } from './build-support-form-url'

describe('buildSupportFormUrl', () => {
  it('appends the chat ID as a pre-filled field when provided', () => {
    expect(buildSupportFormUrl('123e4567-e89b-12d3-a456-426614174000')).toBe(
      'https://form.gov.sg/64929532701266001209ac32?6a979221b8ae314641032f5c=123e4567-e89b-12d3-a456-426614174000',
    )
  })

  it('returns the bare form URL when chatId is empty', () => {
    expect(buildSupportFormUrl('')).toBe(
      'https://form.gov.sg/64929532701266001209ac32',
    )
  })
})
