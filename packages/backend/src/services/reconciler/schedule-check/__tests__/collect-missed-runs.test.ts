import { afterEach, describe, expect, it, vi } from 'vitest'

import { collectMissedRuns } from '../collect-missed-runs'

const mocks = vi.hoisted(() => ({
  fetchLatestExecutionTimes: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('../fetch-latest-execution-times', () => ({
  fetchLatestExecutionTimes: mocks.fetchLatestExecutionTimes,
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: mocks.logError },
}))

const FLOW_OVERDUE = '1c8e8b7d-4b0d-4b44-8a28-1e5e2e1b2b22'
const FLOW_MISSING = '2d7d7c6c-3a9c-4a33-9b17-2d4d1d2c3c33'
const FLOW_BROKEN = '3e6e6d5d-2a8b-4a22-8c06-3c3c0c1d4d44'

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)

function pipe(flowId: string, overrides = {}) {
  return {
    flowId,
    publishedAt: new Date(NOW - 30 * 24 * HOUR).toISOString(),
    triggerKey: 'everyHour',
    triggerParameters: { triggersOnWeekend: true },
    ...overrides,
  }
}

describe('collectMissedRuns', () => {
  const hmget = vi.fn()

  afterEach(() => {
    vi.resetAllMocks()
  })

  function collect(
    input: Partial<Parameters<typeof collectMissedRuns>[0]> = {},
  ) {
    return collectMissedRuns({
      jobsRedis: { hmget },
      publishedPipes: [pipe(FLOW_OVERDUE), pipe(FLOW_MISSING)],
      scheduleEntryByFlowId: new Map([
        [
          FLOW_OVERDUE,
          { member: `flow-${FLOW_OVERDUE}`, runTimeMillis: NOW - 2 * HOUR },
        ],
      ]),
      missingFlowIds: [FLOW_MISSING],
      overdueFlowIds: [FLOW_OVERDUE],
      nowMillis: NOW,
      graceSeconds: 900,
      ...input,
    })
  }

  it('collects missed runs of overdue and missing pipes', async () => {
    hmget.mockResolvedValue(['1', null])
    mocks.fetchLatestExecutionTimes.mockResolvedValue(
      new Map([[FLOW_MISSING, NOW - HOUR - 60_000]]),
    )

    const missedRuns = await collect()

    expect(hmget).toHaveBeenCalledWith(
      `{flowQ}:flow:repeat:flow-${FLOW_OVERDUE}:${NOW - 2 * HOUR}`,
      'timestamp',
      'processedOn',
    )
    expect(mocks.fetchLatestExecutionTimes).toHaveBeenCalledWith([FLOW_MISSING])
    expect(missedRuns).toEqual([
      { flowId: FLOW_OVERDUE, runTimeMillis: NOW - 2 * HOUR, reason: 'late' },
      {
        flowId: FLOW_OVERDUE,
        runTimeMillis: NOW - HOUR,
        reason: 'stale-timestamp',
      },
      {
        flowId: FLOW_MISSING,
        runTimeMillis: NOW - HOUR,
        reason: 'no-redis-entry',
      },
    ])
  })

  it('does not count T when its job already started', async () => {
    hmget.mockResolvedValue(['1', '2'])
    mocks.fetchLatestExecutionTimes.mockResolvedValue(new Map())

    const missedRuns = await collect({ missingFlowIds: [] })

    expect(missedRuns).toEqual([
      {
        flowId: FLOW_OVERDUE,
        runTimeMillis: NOW - HOUR,
        reason: 'stale-timestamp',
      },
    ])
  })

  it('skips a pipe whose schedule cannot be read and logs it', async () => {
    mocks.fetchLatestExecutionTimes.mockResolvedValue(new Map())

    const missedRuns = await collect({
      publishedPipes: [
        pipe(FLOW_BROKEN, { triggerKey: 'unknown' }),
        pipe(FLOW_MISSING, { publishedAt: new Date(NOW - HOUR).toISOString() }),
      ],
      missingFlowIds: [FLOW_BROKEN, FLOW_MISSING],
      overdueFlowIds: [],
    })

    expect(missedRuns).toEqual([])
    expect(mocks.logError).toHaveBeenCalledWith(
      'Schedule check could not read a pipe schedule',
      expect.objectContaining({ flowId: FLOW_BROKEN }),
    )
  })

  it('makes no extra calls when no pipe has a problem', async () => {
    const missedRuns = await collect({ missingFlowIds: [], overdueFlowIds: [] })

    expect(missedRuns).toEqual([])
    expect(hmget).not.toHaveBeenCalled()
    expect(mocks.fetchLatestExecutionTimes).not.toHaveBeenCalled()
  })
})
