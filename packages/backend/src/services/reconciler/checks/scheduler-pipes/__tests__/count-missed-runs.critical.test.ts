/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Count once across all tasks. For each missed run time:
 *   `SET scheduler:missed-run:<flowId>:<runTimeMillis> 1 NX EX 604800`.
 *   Increment `plumber.schedules.missed_runs` only when it returns `OK`."
 * - "The counter carries a `reason` tag."
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { countMissedRuns } from '../count-missed-runs'
import type { MissedRun } from '../missed-runs'

const mocks = vi.hoisted(() => ({
  increment: vi.fn(),
}))

vi.mock('@/helpers/tracer', () => ({
  default: { dogstatsd: { gauge: vi.fn(), increment: mocks.increment } },
}))

// The real module connects to Redis on import.
vi.mock('@/helpers/redis-app-data', () => ({
  makeRedisAppDataKey: (app: string, key: string) => `${app}:${key}`,
}))

const FLOW_ID = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const RUN_TIME = Date.UTC(2026, 9, 20, 1, 0, 0)

function createSharedMarkerRedis() {
  const markers = new Set<string>()
  return {
    set: vi.fn(async (key: string) => {
      if (markers.has(key)) {
        return null
      }
      markers.add(key)
      return 'OK' as const
    }),
  }
}

const MISSED_RUNS: MissedRun[] = [
  { flowId: FLOW_ID, runTimeMillis: RUN_TIME, reason: 'late' },
  {
    flowId: FLOW_ID,
    runTimeMillis: RUN_TIME + 3_600_000,
    reason: 'stale-timestamp',
  },
]

describe('countMissedRuns', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('writes a marker that expires after 7 days and only if absent', async () => {
    const markerRedis = createSharedMarkerRedis()

    await countMissedRuns({ markerRedis, missedRuns: MISSED_RUNS.slice(0, 1) })

    expect(markerRedis.set).toHaveBeenCalledWith(
      `scheduler:missed-run:${FLOW_ID}:${RUN_TIME}`,
      '1',
      'EX',
      604800,
      'NX',
    )
  })

  it('increments the counter with the reason of each missed run', async () => {
    const markerRedis = createSharedMarkerRedis()

    const counted = await countMissedRuns({
      markerRedis,
      missedRuns: MISSED_RUNS,
    })

    expect(counted).toEqual(MISSED_RUNS)
    expect(mocks.increment).toHaveBeenCalledTimes(2)
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
  })

  it('does not count the same run time again on a second check or a second task', async () => {
    const markerRedis = createSharedMarkerRedis()

    await countMissedRuns({ markerRedis, missedRuns: MISSED_RUNS })
    const secondCheck = await countMissedRuns({
      markerRedis,
      missedRuns: MISSED_RUNS,
    })
    const secondTask = await countMissedRuns({
      markerRedis,
      missedRuns: [{ ...MISSED_RUNS[1], reason: 'no-redis-entry' }],
    })

    expect(secondCheck).toEqual([])
    expect(secondTask).toEqual([])
    expect(mocks.increment).toHaveBeenCalledTimes(2)
  })
})
