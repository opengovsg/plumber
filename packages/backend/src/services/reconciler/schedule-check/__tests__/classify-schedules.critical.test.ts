/**
 * Business rules (user decisions), quoted verbatim:
 *
 * - "Overdue pipe: a published scheduled pipe that has a `{flowQ}:flow:repeat`
 *   schedule entry whose run time T is more than G in the past."
 * - "Missing pipe: a published scheduled pipe with no `{flowQ}:flow:repeat`
 *   entry."
 * - "Overdue: T < now − G. G = 15 minutes (user decision), never more than 1
 *   hour. Env var `SCHEDULE_MISSED_RUN_GRACE_SECONDS`, default 900, at most
 *   3600."
 */
import { describe, expect, it } from 'vitest'

import { classifySchedules, parseScheduleEntries } from '../classify-schedules'
import { parseScheduleCheckConfig } from '../config'

const FLOW_A = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const FLOW_B = '1c8e8b7d-4b0d-4b44-8a28-1e5e2e1b2b22'
const FLOW_C = '2d7d7c6c-3a9c-4a33-9b17-2d4d1d2c3c33'

const NOW = Date.UTC(2026, 9, 20, 4, 0, 0)
const GRACE_SECONDS = 900

describe('classifySchedules', () => {
  it('marks a published pipe with no schedule entry as missing', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A],
      nextRunTimeByFlowId: new Map(),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({ missingFlowIds: [FLOW_A], overdueFlowIds: [] })
  })

  it('marks a pipe whose run time is more than G in the past as overdue', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A],
      nextRunTimeByFlowId: new Map([[FLOW_A, NOW - GRACE_SECONDS * 1000 - 1]]),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({ missingFlowIds: [], overdueFlowIds: [FLOW_A] })
  })

  it('treats a run time exactly G in the past as healthy', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A],
      nextRunTimeByFlowId: new Map([[FLOW_A, NOW - GRACE_SECONDS * 1000]]),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({ missingFlowIds: [], overdueFlowIds: [] })
  })

  it('treats past run times within G and future run times as healthy', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A, FLOW_B],
      nextRunTimeByFlowId: new Map([
        [FLOW_A, NOW - 60_000],
        [FLOW_B, NOW + 3_600_000],
      ]),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({ missingFlowIds: [], overdueFlowIds: [] })
  })

  it('ignores schedule entries of pipes that are not published', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A],
      nextRunTimeByFlowId: new Map([
        [FLOW_A, NOW + 60_000],
        [FLOW_B, NOW - 86_400_000],
      ]),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({ missingFlowIds: [], overdueFlowIds: [] })
  })

  it('classifies several pipes at once', () => {
    const result = classifySchedules({
      publishedFlowIds: [FLOW_A, FLOW_B, FLOW_C],
      nextRunTimeByFlowId: new Map([
        [FLOW_B, NOW - 3_600_000],
        [FLOW_C, NOW + 60_000],
      ]),
      nowMillis: NOW,
      graceSeconds: GRACE_SECONDS,
    })

    expect(result).toEqual({
      missingFlowIds: [FLOW_A],
      overdueFlowIds: [FLOW_B],
    })
  })
})

describe('parseScheduleEntries', () => {
  it('reads the flow ID and run time from each entry', () => {
    const entries = parseScheduleEntries([
      `flow-${FLOW_A}`,
      String(NOW),
      `flow-${FLOW_B}`,
      String(NOW + 1000),
    ])

    expect(entries).toEqual(
      new Map([
        [FLOW_A, NOW],
        [FLOW_B, NOW + 1000],
      ]),
    )
  })

  it('reads entries written in the older bullmq member format', () => {
    const entries = parseScheduleEntries([
      `flow-${FLOW_A}:${FLOW_A}:::0 * * * *`,
      String(NOW),
    ])

    expect(entries).toEqual(new Map([[FLOW_A, NOW]]))
  })

  it('keeps the latest run time when a pipe has two entries', () => {
    const entries = parseScheduleEntries([
      `flow-${FLOW_A}:${FLOW_A}:::0 * * * *`,
      String(NOW - 86_400_000),
      `flow-${FLOW_A}`,
      String(NOW),
    ])

    expect(entries).toEqual(new Map([[FLOW_A, NOW]]))
  })

  it('skips entries that do not belong to a pipe', () => {
    const entries = parseScheduleEntries(['something-else', String(NOW)])

    expect(entries).toEqual(new Map())
  })
})

describe('parseScheduleCheckConfig', () => {
  it('defaults G to 15 minutes', () => {
    expect(parseScheduleCheckConfig({}).missedRunGraceSeconds).toBe(900)
  })

  it('accepts G up to 1 hour', () => {
    expect(
      parseScheduleCheckConfig({ SCHEDULE_MISSED_RUN_GRACE_SECONDS: '3600' })
        .missedRunGraceSeconds,
    ).toBe(3600)
  })

  it('rejects G above 1 hour', () => {
    expect(() =>
      parseScheduleCheckConfig({ SCHEDULE_MISSED_RUN_GRACE_SECONDS: '3601' }),
    ).toThrow()
  })
})
