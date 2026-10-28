import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '../checks'

vi.mock('../schedule-check/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the schedule check', () => {
    const checks = createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } })

    expect(checks).toEqual([{ name: 'schedules', run: expect.any(Function) }])
  })

  it('fails fast on an invalid grace period', () => {
    vi.stubEnv('SCHEDULE_MISSED_RUN_GRACE_SECONDS', '0')

    expect(() =>
      createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } }),
    ).toThrow()
  })
})
