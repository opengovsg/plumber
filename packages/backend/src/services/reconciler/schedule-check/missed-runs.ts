import type { IJSONObject } from '@plumber/types'
import cronParser from 'cron-parser'

import schedulerApp from '@/apps/scheduler'

export const MISSED_RUN_MARKER_TTL_SECONDS = 604800

// A run time leaves the window before its marker expires, so no task counts it twice.
const LOOK_BACK_CAP_SECONDS = MISSED_RUN_MARKER_TTL_SECONDS

// BullMQ computes run times in the container time zone.
const SCHEDULE_TIME_ZONE = 'Asia/Singapore'

export type MissedRunReason = 'late' | 'stale-timestamp' | 'no-redis-entry'

export interface MissedRun {
  flowId: string
  runTimeMillis: number
  reason: MissedRunReason
}

export function getSchedulePattern(
  triggerKey: string,
  triggerParameters: IJSONObject,
): string {
  const trigger = schedulerApp.triggers.find(
    (candidate) => candidate.key === triggerKey,
  )
  const pattern = trigger?.getInterval?.(triggerParameters)
  if (!pattern) {
    throw new Error(`Trigger ${triggerKey} has no schedule`)
  }
  return pattern
}

interface DueWindow {
  nowMillis: number
  graceSeconds: number
}

function getDueRange({ nowMillis, graceSeconds }: DueWindow) {
  return {
    earliestMillis: nowMillis - LOOK_BACK_CAP_SECONDS * 1000,
    latestMillis: nowMillis - graceSeconds * 1000,
  }
}

function isDue(runTimeMillis: number, window: DueWindow): boolean {
  const { earliestMillis, latestMillis } = getDueRange(window)
  return runTimeMillis >= earliestMillis && runTimeMillis <= latestMillis
}

function listDueRunTimesAfter(
  pattern: string,
  afterMillis: number,
  window: DueWindow,
): number[] {
  const { earliestMillis, latestMillis } = getDueRange(window)
  if (latestMillis < earliestMillis) {
    return []
  }

  // cron-parser works in whole seconds, so start a second early to keep an exact match.
  const interval = cronParser.parseExpression(pattern, {
    currentDate: new Date(Math.max(afterMillis, earliestMillis - 1000)),
    tz: SCHEDULE_TIME_ZONE,
  })

  const runTimes: number[] = []
  for (
    let runTimeMillis = interval.next().getTime();
    runTimeMillis <= latestMillis;
    runTimeMillis = interval.next().getTime()
  ) {
    if (runTimeMillis > afterMillis && runTimeMillis >= earliestMillis) {
      runTimes.push(runTimeMillis)
    }
  }
  return runTimes
}

interface FindOverduePipeMissedRunsInput extends DueWindow {
  flowId: string
  pattern: string
  nextRunTimeMillis: number
  isNextRunJobPending: boolean
}

export function findOverduePipeMissedRuns({
  flowId,
  pattern,
  nextRunTimeMillis,
  isNextRunJobPending,
  ...window
}: FindOverduePipeMissedRunsInput): MissedRun[] {
  const missedRuns: MissedRun[] = []

  if (isNextRunJobPending && isDue(nextRunTimeMillis, window)) {
    missedRuns.push({
      flowId,
      runTimeMillis: nextRunTimeMillis,
      reason: 'late',
    })
  }

  for (const runTimeMillis of listDueRunTimesAfter(
    pattern,
    nextRunTimeMillis,
    window,
  )) {
    missedRuns.push({ flowId, runTimeMillis, reason: 'stale-timestamp' })
  }

  return missedRuns
}

interface FindMissingPipeMissedRunsInput extends DueWindow {
  flowId: string
  pattern: string
  publishedAtMillis: number
  latestExecutionMillis: number | undefined
}

export function findMissingPipeMissedRuns({
  flowId,
  pattern,
  publishedAtMillis,
  latestExecutionMillis,
  ...window
}: FindMissingPipeMissedRunsInput): MissedRun[] {
  // A pipe that lost its entry today must not count older run times that already ran.
  const startMillis = Math.max(publishedAtMillis, latestExecutionMillis ?? 0)

  return listDueRunTimesAfter(pattern, startMillis, window).map(
    (runTimeMillis) => ({ flowId, runTimeMillis, reason: 'no-redis-entry' }),
  )
}
