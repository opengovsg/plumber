import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  warn: vi.fn(),
}))
vi.mock('posthog-node', () => ({
  // Vitest 4 only constructs mocks built from a function or class.
  PostHog: vi.fn(function () {
    return { isFeatureEnabled: mocks.isFeatureEnabled }
  }),
}))
vi.mock('@/helpers/logger', () => ({ default: { warn: mocks.warn } }))

import { isPostHogFlagEnabled } from '../posthog'

describe('isPostHogFlagEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when the flag is on for the user', async () => {
    mocks.isFeatureEnabled.mockResolvedValue(true)

    await expect(isPostHogFlagEnabled('flag', 'user-id')).resolves.toBe(true)
    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith('flag', 'user-id', {
      sendFeatureFlagEvents: false,
    })
  })

  it('returns false when PostHog does not know the flag', async () => {
    mocks.isFeatureEnabled.mockResolvedValue(undefined)

    await expect(isPostHogFlagEnabled('flag', 'user-id')).resolves.toBe(false)
  })

  it('returns false and logs when PostHog fails', async () => {
    mocks.isFeatureEnabled.mockRejectedValue(new Error('timeout'))

    await expect(isPostHogFlagEnabled('flag', 'user-id')).resolves.toBe(false)
    expect(mocks.warn).toHaveBeenCalledOnce()
  })
})
