import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '..'

vi.mock('../scheduler-pipes/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

vi.mock('../scheduler-pipes/fetch-latest-execution-times', () => ({
  fetchLatestExecutionTimes: vi.fn(),
}))

vi.mock('@/helpers/redis-app-data', () => ({
  makeRedisAppDataKey: vi.fn(),
}))

const REDIS_CLIENTS = {
  jobsRedis: { zrange: vi.fn(), hmget: vi.fn() },
  markerRedis: { multi: vi.fn() },
}

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the scheduler pipes check', () => {
    const checks = createReconcilerChecks(REDIS_CLIENTS)

    expect(checks).toEqual([
      { name: 'scheduler-pipes', run: expect.any(Function) },
    ])
  })

  it('fails fast on an invalid grace period', () => {
    vi.stubEnv('SCHEDULE_MISSED_RUN_GRACE_SECONDS', '0')

    expect(() => createReconcilerChecks(REDIS_CLIENTS)).toThrow()
  })
})
