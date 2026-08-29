import type { IApp } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'

import { getStepVersion } from '../get-step-version'

const getLatestStepVersion = vi.fn()

describe('getStepVersion', () => {
  beforeEach(() => {
    getLatestStepVersion.mockReset()
    apps.appWithTransformer = {
      stepTransformer: {
        getLatestStepVersion,
      },
    } as unknown as IApp
    apps.appWithoutTransformer = {} as unknown as IApp
  })

  afterEach(() => {
    delete apps.appWithTransformer
    delete apps.appWithoutTransformer
    vi.restoreAllMocks()
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
    getLatestStepVersion.mockReturnValue(3)

    expect(getStepVersion('appWithTransformer', 'someKey')).toBe(3)
    expect(getLatestStepVersion).toHaveBeenCalledWith('someKey')
  })

  it('returns 1 when stepTransformer.getLatestStepVersion returns nullish', () => {
    getLatestStepVersion.mockReturnValue(null)

    expect(getStepVersion('appWithTransformer', 'someKey')).toBe(1)
  })
})
