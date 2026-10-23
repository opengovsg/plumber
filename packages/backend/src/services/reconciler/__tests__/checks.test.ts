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
  jobsRedis: { zrange: vi.fn(), hmget: vi.fn() },
  markerRedis: { set: vi.fn() },
}

describe('createReconcilerChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes the schedule check on its configured interval', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS', '120')

    const checks = createReconcilerChecks(REDIS_CLIENTS)

    expect(checks).toEqual([
      expect.objectContaining({ name: 'schedules', intervalSeconds: 120 }),
    ])
  })

  it('fails fast on an invalid interval', () => {
    vi.stubEnv('RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS', '0')

    expect(() => createReconcilerChecks(REDIS_CLIENTS)).toThrow()
  })
})
