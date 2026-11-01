/**
 * Business rules (user decisions):
 *
 * - Count a run time only when `ZADD NX` adds it.
 * - The `plumber.executions.missed` metric counts each missed run exactly once.
 * - Each missed run carries a `reason` tag.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { countMissedRuns } from '../count-missed-runs'
import type { MissedRun } from '../missed-runs'
import { createFakeMarkerRedis } from './fake-marker-redis'

const mocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), warn: mocks.logWarn, error: vi.fn() },
}))

// The real module connects to Redis on import.
vi.mock('@/helpers/redis-app-data', () => ({
  makeRedisAppDataKey: (app: string, key: string) => `${app}:${key}`,
}))

const FLOW_ID = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)
const HOUR = 3_600_000
const RUN_TIME = NOW - 3 * HOUR
const WEEK_MILLIS = 604800 * 1000

const MISSED_RUNS: MissedRun[] = [
  { flowId: FLOW_ID, runTimeMillis: RUN_TIME, reason: 'overdue' },
  {
    flowId: FLOW_ID,
    runTimeMillis: RUN_TIME + HOUR,
    reason: 'stuck-at-earlier-timestamp',
  },
  {
    flowId: FLOW_ID,
    runTimeMillis: RUN_TIME + 2 * HOUR,
    reason: 'stuck-at-earlier-timestamp',
  },
]

function missedRunLine(reason: MissedRun['reason']) {
  return [
    'Scheduler pipes check counted a missed run',
    { event: 'reconciler-missed-run', flowId: FLOW_ID, reason },
  ]
}

describe('countMissedRuns', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs one line with its reason for each newly counted run time', async () => {
    const redis = createFakeMarkerRedis()

    const count = await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: MISSED_RUNS,
      nowMillis: NOW,
    })

    expect(count).toBe(3)
    expect(mocks.logWarn.mock.calls).toEqual([
      missedRunLine('overdue'),
      missedRunLine('stuck-at-earlier-timestamp'),
      missedRunLine('stuck-at-earlier-timestamp'),
    ])
  })

  it('does not count the same run time again on a second check or a second task', async () => {
    const redis = createFakeMarkerRedis()

    await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: MISSED_RUNS,
      nowMillis: NOW,
    })
    const secondCheck = await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: MISSED_RUNS,
      nowMillis: NOW + HOUR,
    })
    const secondTask = await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: [{ ...MISSED_RUNS[1], reason: 'no-redis-entry' }],
      nowMillis: NOW,
    })

    expect(secondCheck).toBe(0)
    expect(secondTask).toBe(0)
    expect(mocks.logWarn).toHaveBeenCalledTimes(3)
  })

  it('adds run times to one sorted set per pipe only if absent', async () => {
    const redis = createFakeMarkerRedis()

    await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: MISSED_RUNS,
      nowMillis: NOW,
    })

    const key = `scheduler:missed-runs:${FLOW_ID}`
    expect(redis.commands).toContainEqual([
      'zadd',
      key,
      'NX',
      RUN_TIME,
      String(RUN_TIME),
    ])
    expect(redis.commands).toContainEqual([
      'zadd',
      key,
      'NX',
      RUN_TIME + HOUR,
      String(RUN_TIME + HOUR),
      RUN_TIME + 2 * HOUR,
      String(RUN_TIME + 2 * HOUR),
    ])
  })

  it('keeps counted run times for two look-backs and expires the set after 7 days', async () => {
    const redis = createFakeMarkerRedis()
    const key = `scheduler:missed-runs:${FLOW_ID}`
    const twoWeeksAgo = NOW - 2 * WEEK_MILLIS
    redis.sortedSets.set(
      key,
      new Map([
        [String(twoWeeksAgo - 1), twoWeeksAgo - 1],
        [String(twoWeeksAgo), twoWeeksAgo],
      ]),
    )

    await countMissedRuns({
      markerRedis: redis.client,
      missedRuns: MISSED_RUNS.slice(0, 1),
      nowMillis: NOW,
    })

    expect([...(redis.sortedSets.get(key)?.keys() ?? [])]).toEqual([
      String(twoWeeksAgo),
      String(RUN_TIME),
    ])
    expect(redis.expirySecondsByKey.get(key)).toBe(604800)
  })

  it('sends at most 10 pipes to Redis at once', async () => {
    const redis = createFakeMarkerRedis()
    const missedRuns = Array.from({ length: 25 }, (_, index) => ({
      flowId: `flow-${index}`,
      runTimeMillis: RUN_TIME,
      reason: 'no-redis-entry' as const,
    }))

    const count = await countMissedRuns({
      markerRedis: redis.client,
      missedRuns,
      nowMillis: NOW,
    })

    expect(count).toBe(25)
    expect(redis.state.maxInFlight).toBe(10)
  })

  it('fails the check and logs nothing when Redis fails', async () => {
    const redis = createFakeMarkerRedis()
    redis.state.failWith = new Error('redis down')

    await expect(
      countMissedRuns({
        markerRedis: redis.client,
        missedRuns: MISSED_RUNS,
        nowMillis: NOW,
      }),
    ).rejects.toThrow('redis down')
    expect(mocks.logWarn).not.toHaveBeenCalled()
  })
})
