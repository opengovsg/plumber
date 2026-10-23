/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Overdue pipe: start at T. Count every cron run time t after T with
 *   t + G ≤ now. This applies to a broken chain too."
 * - "Also count T itself when its job has not started (backlog: T will start
 *   more than G late)."
 * - "Missing pipe: start at the later of `flows.published_at` and the pipe's
 *   latest non-test execution."
 * - "Never count future run times."
 * - "Look-back cap. Only check run times within the cap."
 * - "Cap = marker TTL (604800 s), derived from the same constant."
 * - "Run times come from the pipe's cron pattern via
 *   `trigger.getInterval(triggerStep.parameters)`, the same call publishing
 *   uses. Use `cron-parser` with `Asia/Singapore`."
 */
import { describe, expect, it } from 'vitest'

import {
  findMissingPipeMissedRuns,
  findOverduePipeMissedRuns,
  getSchedulePattern,
  MISSED_RUN_MARKER_TTL_SECONDS,
} from '../missed-runs'

const FLOW_ID = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const HOURLY = '0 * * * *'
const HOUR = 3_600_000
const GRACE_SECONDS = 900

// Tuesday 2026-10-20 12:00 in Singapore.
const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)

describe('findOverduePipeMissedRuns', () => {
  it('counts run times after T that are more than G in the past', () => {
    const missedRuns = findOverduePipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      nextRunTimeMillis: NOW - 3 * HOUR,
      isNextRunJobPending: false,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      {
        flowId: FLOW_ID,
        runTimeMillis: NOW - 2 * HOUR,
        reason: 'stale-timestamp',
      },
      { flowId: FLOW_ID, runTimeMillis: NOW - HOUR, reason: 'stale-timestamp' },
    ])
  })

  it('counts T as late when its job has not started', () => {
    const missedRuns = findOverduePipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      nextRunTimeMillis: NOW - 2 * HOUR,
      isNextRunJobPending: true,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      { flowId: FLOW_ID, runTimeMillis: NOW - 2 * HOUR, reason: 'late' },
      { flowId: FLOW_ID, runTimeMillis: NOW - HOUR, reason: 'stale-timestamp' },
    ])
  })

  it('counts a run time exactly G in the past', () => {
    const missedRuns = findOverduePipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      nextRunTimeMillis: NOW - HOUR,
      isNextRunJobPending: false,
      nowMillis: NOW + GRACE_SECONDS * 1000,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      { flowId: FLOW_ID, runTimeMillis: NOW, reason: 'stale-timestamp' },
    ])
  })

  it('does not count run times within G or in the future', () => {
    const missedRuns = findOverduePipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      nextRunTimeMillis: NOW - HOUR,
      isNextRunJobPending: false,
      nowMillis: NOW + GRACE_SECONDS * 1000 - 1,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([])
  })

  it('does not count run times older than the look-back cap', () => {
    const capMillis = MISSED_RUN_MARKER_TTL_SECONDS * 1000
    const missedRuns = findOverduePipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      nextRunTimeMillis: NOW - capMillis - 24 * HOUR,
      isNextRunJobPending: true,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toHaveLength(7 * 24)
    expect(missedRuns[0]).toEqual({
      flowId: FLOW_ID,
      runTimeMillis: NOW - capMillis,
      reason: 'stale-timestamp',
    })
    expect(missedRuns.at(-1)?.runTimeMillis).toBe(NOW - HOUR)
  })

  it('sets the look-back cap to 7 days', () => {
    expect(MISSED_RUN_MARKER_TTL_SECONDS).toBe(604800)
  })
})

describe('findMissingPipeMissedRuns', () => {
  it('counts run times after the publish time that are more than G in the past', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      publishedAtMillis: NOW - 3 * HOUR,
      latestExecutionMillis: undefined,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      {
        flowId: FLOW_ID,
        runTimeMillis: NOW - 2 * HOUR,
        reason: 'no-redis-entry',
      },
      { flowId: FLOW_ID, runTimeMillis: NOW - HOUR, reason: 'no-redis-entry' },
    ])
  })

  it('starts after the latest execution when it is later than the publish time', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      publishedAtMillis: NOW - 30 * 24 * HOUR,
      latestExecutionMillis: NOW - 2 * HOUR + 5_000,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      { flowId: FLOW_ID, runTimeMillis: NOW - HOUR, reason: 'no-redis-entry' },
    ])
  })

  it('starts after the publish time when it is later than the latest execution', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      publishedAtMillis: NOW - HOUR - 1,
      latestExecutionMillis: NOW - 10 * HOUR,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toEqual([
      { flowId: FLOW_ID, runTimeMillis: NOW - HOUR, reason: 'no-redis-entry' },
    ])
  })

  it('does not count future run times', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      publishedAtMillis: NOW - 1,
      latestExecutionMillis: undefined,
      nowMillis: NOW + 2 * HOUR,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns.map((missedRun) => missedRun.runTimeMillis)).toEqual([
      NOW,
      NOW + HOUR,
    ])
  })

  it('does not count run times older than the look-back cap', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: HOURLY,
      publishedAtMillis: NOW - 30 * 24 * HOUR,
      latestExecutionMillis: undefined,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns).toHaveLength(7 * 24)
    expect(missedRuns[0].runTimeMillis).toBe(
      NOW - MISSED_RUN_MARKER_TTL_SECONDS * 1000,
    )
  })

  it('reads run times in Singapore time', () => {
    const missedRuns = findMissingPipeMissedRuns({
      flowId: FLOW_ID,
      pattern: getSchedulePattern('everyDay', {
        hour: 9,
        triggersOnWeekend: false,
      }),
      publishedAtMillis: Date.UTC(2026, 9, 19, 0, 0, 0),
      latestExecutionMillis: undefined,
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(missedRuns.map((missedRun) => missedRun.runTimeMillis)).toEqual([
      Date.UTC(2026, 9, 19, 1, 0, 0),
      Date.UTC(2026, 9, 20, 1, 0, 0),
    ])
  })
})

describe('getSchedulePattern', () => {
  it('uses the trigger interval that publishing uses', () => {
    expect(getSchedulePattern('everyHour', { triggersOnWeekend: false })).toBe(
      '0 * * * 1-5',
    )
    expect(getSchedulePattern('everyWeek', { weekday: 3, hour: 14 })).toBe(
      '0 14 * * 3',
    )
  })

  it('throws for a trigger without a schedule', () => {
    expect(() => getSchedulePattern('unknown', {})).toThrow()
  })
})
