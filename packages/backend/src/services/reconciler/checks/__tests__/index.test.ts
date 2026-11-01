import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '..'

vi.mock('../scheduler-pipes/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the scheduler pipes check', () => {
    const checks = createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } })

    expect(checks).toEqual([
      { name: 'scheduler-pipes', run: expect.any(Function) },
    ])
  })

  it('fails fast on an invalid grace period', () => {
    vi.stubEnv('SCHEDULE_MISSED_RUN_GRACE_SECONDS', '0')

    expect(() =>
      createReconcilerChecks({ jobsRedis: { zrange: vi.fn() } }),
    ).toThrow()
  })
})
