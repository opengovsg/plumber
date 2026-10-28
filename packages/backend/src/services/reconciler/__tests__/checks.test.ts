import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerChecks } from '../checks'

vi.mock('../schedule-check/fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: vi.fn(),
}))

vi.mock('../schedule-check/fetch-latest-execution-times', () => ({
  fetchLatestExecutionTimes: vi.fn(),
}))

vi.mock('@/helpers/redis-app-data', () => ({
  makeRedisAppDataKey: vi.fn(),
}))

const REDIS_CLIENTS = {
  jobsRedis: { zrange: vi.fn(), hmget: vi.fn(), zcount: vi.fn() },
  markerRedis: { set: vi.fn() },
}

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the schedule and delayed jobs checks', () => {
    const checks = createReconcilerChecks(REDIS_CLIENTS)

    expect(checks).toEqual([
      { name: 'schedules', run: expect.any(Function) },
      { name: 'delayed-jobs', run: expect.any(Function) },
    ])
  })

  it('fails fast on an invalid grace period', () => {
    vi.stubEnv('SCHEDULE_MISSED_RUN_GRACE_SECONDS', '0')

    expect(() => createReconcilerChecks(REDIS_CLIENTS)).toThrow()
  })
})
