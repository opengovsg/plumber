import { describe, expect, it, vi } from 'vitest'

vi.mock('@/posthog', () => ({
  default: {},
  isPostHogConfigured: true,
}))

import { isCheckStepAiFixVariantEnabled } from '../useCheckStepAiFixEnabled'

describe('isCheckStepAiFixVariantEnabled', () => {
  it('is true for a non-control variant', () => {
    expect(isCheckStepAiFixVariantEnabled('test')).toBe(true)
  })

  it('is false for the control variant', () => {
    expect(isCheckStepAiFixVariantEnabled('control')).toBe(false)
  })

  it('is false when the user is not in the experiment', () => {
    expect(isCheckStepAiFixVariantEnabled(undefined)).toBe(false)
    expect(isCheckStepAiFixVariantEnabled(false)).toBe(false)
  })
})
