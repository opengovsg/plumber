import { describe, expect, it, vi } from 'vitest'

import { PLUMPRO_FEATURE_FLAG } from '@/config/flags'

import { resolveIsPlumPro } from '../useIsPlumPro'

describe('resolveIsPlumPro', () => {
  it('reads the PlumPro flag, defaulting to off', () => {
    const getFlagValue = vi.fn().mockReturnValue(false)

    resolveIsPlumPro(getFlagValue)

    expect(getFlagValue).toHaveBeenCalledWith(PLUMPRO_FEATURE_FLAG, false)
  })

  it('is true when the flag is on', () => {
    expect(resolveIsPlumPro(() => true)).toBe(true)
  })

  it('is false when the flag is off', () => {
    expect(resolveIsPlumPro(() => false)).toBe(false)
  })

  it('is false when the flag is missing', () => {
    expect(resolveIsPlumPro(() => undefined)).toBe(false)
  })
})
