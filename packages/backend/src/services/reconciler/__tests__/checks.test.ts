import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '../checks'

vi.mock('../schedule-check/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the schedule check on its configured interval', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS', '120')

    const checks = createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } })

    expect(checks).toEqual([
      expect.objectContaining({ name: 'schedules', intervalSeconds: 120 }),
    ])
  })

  it('fails fast on an invalid interval', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS', '0')

    expect(() =>
      createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } }),
    ).toThrow()
  })
})
