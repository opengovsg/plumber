import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ScheduleEntry } from './classify-schedules'
import { fetchLatestExecutionTimes } from './fetch-latest-execution-times'
import type { PublishedScheduledPipe } from './fetch-published-scheduled-pipes'
import { isRunTimeJobPending } from './is-run-time-job-pending'
import {
  findMissingPipeMissedRuns,
  findOverduePipeMissedRuns,
  getSchedulePattern,
  type MissedRun,
} from './missed-runs'

interface CollectMissedRunsInput {
  jobsRedis: Pick<Redis, 'hmget'>
  publishedPipes: PublishedScheduledPipe[]
  scheduleEntryByFlowId: Map<string, ScheduleEntry>
  missingFlowIds: string[]
  overdueFlowIds: string[]
  nowMillis: number
  graceSeconds: number
}

// One pipe with bad trigger parameters must not stop the gauges for every other pipe.
function readSchedulePattern(pipe: PublishedScheduledPipe): string | null {
  try {
    return getSchedulePattern(pipe.triggerKey, pipe.triggerParameters)
  } catch (error) {
    logger.error('Schedule check could not read a pipe schedule', {
      event: 'reconciler-schedule-pattern-error',
      flowId: pipe.flowId,
      triggerKey: pipe.triggerKey,
      error,
    })
    return null
  }
}

export async function collectMissedRuns({
  jobsRedis,
  publishedPipes,
  scheduleEntryByFlowId,
  missingFlowIds,
  overdueFlowIds,
  nowMillis,
  graceSeconds,
}: CollectMissedRunsInput): Promise<MissedRun[]> {
  const pipeByFlowId = new Map(
    publishedPipes.map((pipe) => [pipe.flowId, pipe]),
  )
  const missedRuns: MissedRun[] = []

  for (const flowId of overdueFlowIds) {
    const pipe = pipeByFlowId.get(flowId)
    const scheduleEntry = scheduleEntryByFlowId.get(flowId)
    if (!pipe || !scheduleEntry) {
      continue
    }
    const pattern = readSchedulePattern(pipe)
    if (pattern === null) {
      continue
    }

    const isNextRunJobPending = await isRunTimeJobPending({
      jobsRedis,
      flowId,
      scheduleEntryMember: scheduleEntry.member,
      runTimeMillis: scheduleEntry.runTimeMillis,
    })
    missedRuns.push(
      ...findOverduePipeMissedRuns({
        flowId,
        pattern,
        nextRunTimeMillis: scheduleEntry.runTimeMillis,
        isNextRunJobPending,
        nowMillis,
        graceSeconds,
      }),
    )
  }

  if (missingFlowIds.length === 0) {
    return missedRuns
  }

  const latestExecutionMillisByFlowId =
    await fetchLatestExecutionTimes(missingFlowIds)
  for (const flowId of missingFlowIds) {
    const pipe = pipeByFlowId.get(flowId)
    if (!pipe) {
      continue
    }
    const pattern = readSchedulePattern(pipe)
    if (pattern === null) {
      continue
    }

    missedRuns.push(
      ...findMissingPipeMissedRuns({
        flowId,
        pattern,
        publishedAtMillis: pipe.publishedAt
          ? new Date(pipe.publishedAt).getTime()
          : 0,
        latestExecutionMillis: latestExecutionMillisByFlowId.get(flowId),
        nowMillis,
        graceSeconds,
      }),
    )
  }

  return missedRuns
}
