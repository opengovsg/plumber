import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isWithinNightlyWindow,
  runNightly,
} from '@/models/tiles/migration/run-nightly'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  appConfig: { isProd: false, isDev: false },
}))

vi.mock('@/config/app', () => ({ default: mocks.appConfig }))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

function mockFlags(flags: { mode: string; ignoreWindow?: boolean }) {
  mocks.getLdFlagValue.mockImplementation(
    async (flag: string, _email: string | null, fallback: unknown) => {
      if (flag === 'tiles-ddb-migration') {
        return flags.mode
      }
      if (flag === 'tiles-ddb-migration-ignore-window') {
        return flags.ignoreWindow ?? fallback
      }
      return fallback
    },
  )
}

// SGT is UTC+8, so 01:00 SGT is 17:00 UTC on the previous day.
const SGT_00_59_59 = new Date('2026-10-18T16:59:59.999Z')
const SGT_01_00 = new Date('2026-10-18T17:00:00.000Z')
const SGT_04_59_59 = new Date('2026-10-18T20:59:59.999Z')
const SGT_05_00 = new Date('2026-10-18T21:00:00.000Z')
const SGT_14_00 = new Date('2026-10-19T06:00:00.000Z')

describe('isWithinNightlyWindow', () => {
  it.each([
    [SGT_00_59_59, false],
    [SGT_01_00, true],
    [SGT_04_59_59, true],
    [SGT_05_00, false],
    [SGT_14_00, false],
  ])('%o -> %s', (now, expected) => {
    expect(isWithinNightlyWindow(now)).toBe(expected)
  })
})

describe('runNightly', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.appConfig.isProd = false
    mocks.appConfig.isDev = false
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('exits when the flag is off, even inside the window', async () => {
    vi.setSystemTime(SGT_01_00)
    mockFlags({ mode: 'off' })
    await expect(runNightly()).resolves.toBe('flag-off')
  })

  it('treats an unknown flag value as off', async () => {
    vi.setSystemTime(SGT_01_00)
    mockFlags({ mode: 'something-else' })
    await expect(runNightly()).resolves.toBe('flag-off')
  })

  it.each([
    ['00:59:59', 'outside-window', SGT_00_59_59],
    ['01:00', 'ran', SGT_01_00],
    ['04:59:59 (late start)', 'ran', SGT_04_59_59],
    ['05:00', 'outside-window', SGT_05_00],
    ['14:00 (manual promotion)', 'outside-window', SGT_14_00],
  ])('at %s SGT returns %s', async (_label, expected, now) => {
    vi.setSystemTime(now)
    mockFlags({ mode: 'migrate' })
    await expect(runNightly()).resolves.toBe(expected)
  })

  it('skips the window check when the override flag is on outside production', async () => {
    vi.setSystemTime(SGT_14_00)
    mockFlags({ mode: 'migrate', ignoreWindow: true })
    await expect(runNightly()).resolves.toBe('ran')
  })

  it('defaults the override to isDev', async () => {
    vi.setSystemTime(SGT_14_00)
    mocks.appConfig.isDev = true
    mockFlags({ mode: 'migrate' })
    await expect(runNightly()).resolves.toBe('ran')
  })

  it('uses the flag fallbacks when LaunchDarkly cannot initialize', async () => {
    vi.setSystemTime(SGT_14_00)
    mocks.getLdFlagValue.mockRejectedValue(new Error('Authentication failed'))
    await expect(runNightly()).resolves.toBe('flag-off')
  })

  it('uses the isDev window fallback when LaunchDarkly cannot initialize', async () => {
    vi.setSystemTime(SGT_14_00)
    mocks.appConfig.isDev = true
    mocks.getLdFlagValue.mockImplementation(async (flag: string) => {
      if (flag === 'tiles-ddb-migration') {
        return 'migrate'
      }
      throw new Error('Authentication failed')
    })
    await expect(runNightly()).resolves.toBe('ran')
  })

  it('ignores the override flag in production', async () => {
    vi.setSystemTime(SGT_14_00)
    mocks.appConfig.isProd = true
    mockFlags({ mode: 'migrate', ignoreWindow: true })
    await expect(runNightly()).resolves.toBe('outside-window')
    expect(mocks.getLdFlagValue).not.toHaveBeenCalledWith(
      'tiles-ddb-migration-ignore-window',
      expect.anything(),
      expect.anything(),
    )
  })
})
