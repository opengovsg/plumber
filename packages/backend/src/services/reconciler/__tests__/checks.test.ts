import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '../checks'

vi.mock('../schedule-check/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the schedule check on its configured cron pattern', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_CRON', '5 * * * *')

    const checks = createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } })

    expect(checks).toEqual([
      expect.objectContaining({
        name: 'schedules',
        cronPattern: '5 * * * *',
      }),
    ])
  })

  it('fails fast on an invalid cron pattern', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_CRON', 'abc')

    expect(() =>
      createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } }),
    ).toThrow()
  })
})
