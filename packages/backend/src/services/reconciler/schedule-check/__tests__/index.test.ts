import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createScheduleCheck, SCHEDULE_ENTRIES_KEY } from '..'

const mocks = vi.hoisted(() => ({
  fetchPublishedScheduledPipes: vi.fn(),
  fetchLatestExecutionTimes: vi.fn(),
  gauge: vi.fn(),
  increment: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../fetch-published-scheduled-pipes', () => ({
  fetchPublishedScheduledPipes: mocks.fetchPublishedScheduledPipes,
}))

vi.mock('../fetch-latest-execution-times', () => ({
  fetchLatestExecutionTimes: mocks.fetchLatestExecutionTimes,
}))

// The real module connects to Redis on import.
vi.mock('@/helpers/redis-app-data', () => ({
  makeRedisAppDataKey: (app: string, key: string) => `${app}:${key}`,
}))

vi.mock('@/helpers/tracer', () => ({
  default: { dogstatsd: { gauge: mocks.gauge, increment: mocks.increment } },
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: mocks.logInfo, warn: mocks.logWarn, error: vi.fn() },
}))

const FLOW_HEALTHY = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const FLOW_OVERDUE = '1c8e8b7d-4b0d-4b44-8a28-1e5e2e1b2b22'
const FLOW_MISSING = '2d7d7c6c-3a9c-4a33-9b17-2d4d1d2c3c33'

const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)
const HOUR = 3_600_000

function pipe(flowId: string) {
  return {
    flowId,
    publishedAt: '2026-01-01T00:00:00.000Z',
    triggerKey: 'everyHour',
    triggerParameters: { triggersOnWeekend: true },
  }
}

describe('createScheduleCheck', () => {
  const zrange = vi.fn()
  const hmget = vi.fn()
  const set = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    hmget.mockResolvedValue([null, null])
    set.mockResolvedValue('OK')
    mocks.fetchLatestExecutionTimes.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  function makeCheck() {
    return createScheduleCheck({
      jobsRedis: { zrange, hmget },
      markerRedis: { set },
      config: { checkIntervalSeconds: 300, missedRunGraceSeconds: 900 },
    })
  }

  it('uses the configured interval', () => {
    expect(makeCheck().intervalSeconds).toBe(300)
  })

  it('emits gauges and logs the IDs of problem pipes', async () => {
    mocks.fetchPublishedScheduledPipes.mockResolvedValue([
      pipe(FLOW_HEALTHY),
      pipe(FLOW_OVERDUE),
      pipe(FLOW_MISSING),
    ])
    zrange.mockResolvedValue([
      `flow-${FLOW_HEALTHY}`,
      String(NOW + 60_000),
      `flow-${FLOW_OVERDUE}`,
      String(NOW - 3_600_000),
    ])

    await makeCheck().run()

    expect(zrange).toHaveBeenCalledWith(
      SCHEDULE_ENTRIES_KEY,
      0,
      -1,
      'WITHSCORES',
    )
    expect(mocks.gauge).toHaveBeenCalledWith('plumber.schedules.missing', 1, {})
    expect(mocks.gauge).toHaveBeenCalledWith('plumber.schedules.overdue', 1, {})
    expect(mocks.logWarn).toHaveBeenCalledWith(
      'Schedule check found problem pipes',
      expect.objectContaining({
        missingFlowIds: [FLOW_MISSING],
        overdueFlowIds: [FLOW_OVERDUE],
      }),
    )
  })

  it('emits zero gauges when every schedule is healthy', async () => {
    mocks.fetchPublishedScheduledPipes.mockResolvedValue([pipe(FLOW_HEALTHY)])
    zrange.mockResolvedValue([`flow-${FLOW_HEALTHY}`, String(NOW + 60_000)])

    await makeCheck().run()

    expect(mocks.gauge).toHaveBeenCalledWith('plumber.schedules.missing', 0, {})
    expect(mocks.gauge).toHaveBeenCalledWith('plumber.schedules.overdue', 0, {})
    expect(mocks.logWarn).not.toHaveBeenCalled()
    expect(mocks.logInfo).toHaveBeenCalledWith(
      'Schedule check found no problem pipes',
      expect.objectContaining({ publishedPipeCount: 1 }),
    )
  })

  it('emits no gauge when Postgres fails', async () => {
    mocks.fetchPublishedScheduledPipes.mockRejectedValue(new Error('pg down'))

    await expect(makeCheck().run()).rejects.toThrow('pg down')
    expect(mocks.gauge).not.toHaveBeenCalled()
  })

  it('counts missed runs of overdue and missing pipes', async () => {
    mocks.fetchPublishedScheduledPipes.mockResolvedValue([
      pipe(FLOW_OVERDUE),
      pipe(FLOW_MISSING),
    ])
    zrange.mockResolvedValue([`flow-${FLOW_OVERDUE}`, String(NOW - 2 * HOUR)])
    hmget.mockResolvedValue(['1', null])
    mocks.fetchLatestExecutionTimes.mockResolvedValue(
      new Map([[FLOW_MISSING, NOW - HOUR - 60_000]]),
    )

    await makeCheck().run()

    expect(set).toHaveBeenCalledTimes(3)
    expect(set).toHaveBeenCalledWith(
      `scheduler:missed-run:${FLOW_MISSING}:${NOW - HOUR}`,
      '1',
      'EX',
      604800,
      'NX',
    )
    expect(mocks.increment).toHaveBeenCalledWith(
      'plumber.schedules.missed_runs',
      1,
      { reason: 'late' },
    )
    expect(mocks.increment).toHaveBeenCalledWith(
      'plumber.schedules.missed_runs',
      1,
      { reason: 'stale-timestamp' },
    )
    expect(mocks.increment).toHaveBeenCalledWith(
      'plumber.schedules.missed_runs',
      1,
      { reason: 'no-redis-entry' },
    )
    expect(mocks.logWarn).toHaveBeenCalledWith(
      'Schedule check found problem pipes',
      expect.objectContaining({ newlyCountedMissedRunCount: 3 }),
    )
  })

  it('emits no gauge when writing a marker fails', async () => {
    mocks.fetchPublishedScheduledPipes.mockResolvedValue([pipe(FLOW_OVERDUE)])
    zrange.mockResolvedValue([`flow-${FLOW_OVERDUE}`, String(NOW - 2 * HOUR)])
    set.mockRejectedValue(new Error('redis down'))

    await expect(makeCheck().run()).rejects.toThrow('redis down')
    expect(mocks.gauge).not.toHaveBeenCalled()
  })

  it('emits no gauge when Redis fails', async () => {
    mocks.fetchPublishedScheduledPipes.mockResolvedValue([pipe(FLOW_HEALTHY)])
    zrange.mockRejectedValue(new Error('redis down'))

    await expect(makeCheck().run()).rejects.toThrow('redis down')
    expect(mocks.gauge).not.toHaveBeenCalled()
  })
})
