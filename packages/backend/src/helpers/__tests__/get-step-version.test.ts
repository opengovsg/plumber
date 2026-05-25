import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLatestStepVersion: vi.fn(),
}))

vi.mock('@/apps', () => ({
  default: {
    appWithTransformer: {
      stepTransformer: {
        getLatestStepVersion: mocks.getLatestStepVersion,
      },
    },
    appWithoutTransformer: {},
  },
}))

import { getStepVersion } from '../get-step-version'

describe('getStepVersion', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 1 when appKey is undefined', () => {
    expect(getStepVersion(undefined, 'someKey')).toBe(1)
  })

  it('returns 1 when key is undefined', () => {
    expect(getStepVersion('appWithTransformer', undefined)).toBe(1)
  })

  it('returns 1 when both appKey and key are undefined', () => {
    expect(getStepVersion(undefined, undefined)).toBe(1)
  })

  it('returns 1 when the app does not have a stepTransformer', () => {
    expect(getStepVersion('appWithoutTransformer', 'someKey')).toBe(1)
  })

  it('returns 1 when the app does not exist', () => {
    expect(getStepVersion('nonExistentApp', 'someKey')).toBe(1)
  })

  it('returns the version from stepTransformer.getLatestStepVersion', () => {
    mocks.getLatestStepVersion.mockReturnValue(3)

    expect(getStepVersion('appWithTransformer', 'someKey')).toBe(3)
    expect(mocks.getLatestStepVersion).toHaveBeenCalledWith('someKey')
  })

  it('returns 1 when stepTransformer.getLatestStepVersion returns nullish', () => {
    mocks.getLatestStepVersion.mockReturnValue(null)

    expect(getStepVersion('appWithTransformer', 'someKey')).toBe(1)
  })
})
