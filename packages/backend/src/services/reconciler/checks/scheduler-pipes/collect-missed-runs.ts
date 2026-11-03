import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { ScheduleEntry } from './classify-schedules'
import { fetchLatestExecutionTimes } from './fetch-latest-execution-times'
import type { PublishedScheduledPipe } from './fetch-published-scheduled-pipes'
import { isRunTimeJobPending } from './is-run-time-job-pending'
import {
  findMissingPipeMissedRuns,
  findOverduePipeMissedRuns,
  getLookBackStartMillis,
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

// One pipe with a bad schedule must not stop the check for every other pipe.
// IMPORTANT: Not a try/catch around each loop body, which would also swallow Redis errors that must fail the run.
function listPipeMissedRuns(
  pipe: PublishedScheduledPipe,
  listMissedRuns: (pattern: string) => MissedRun[],
): MissedRun[] {
  try {
    return listMissedRuns(
      getSchedulePattern(pipe.triggerKey, pipe.triggerParameters),
    )
  } catch (error) {
    logger.error('Scheduler pipes check could not read a pipe schedule', {
      event: 'reconciler-schedule-pattern-error',
      flowId: pipe.flowId,
      triggerKey: pipe.triggerKey,
      error,
    })
    return []
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
  const overdueMissedRuns: MissedRun[] = []

  // One pipe at a time, so the job queues never wait behind more than one HMGET.
  for (const flowId of overdueFlowIds) {
    const pipe = pipeByFlowId.get(flowId)
    const scheduleEntry = scheduleEntryByFlowId.get(flowId)
    if (!pipe || !scheduleEntry) {
      continue
    }

    const isNextRunJobPending = await isRunTimeJobPending({
      jobsRedis,
      flowId,
      scheduleEntryMember: scheduleEntry.member,
      runTimeMillis: scheduleEntry.runTimeMillis,
    })
    overdueMissedRuns.push(
      ...listPipeMissedRuns(pipe, (pattern) =>
        findOverduePipeMissedRuns({
          flowId,
          pattern,
          nextRunTimeMillis: scheduleEntry.runTimeMillis,
          isNextRunJobPending,
          nowMillis,
          graceSeconds,
        }),
      ),
    )
  }

  if (missingFlowIds.length === 0) {
    return overdueMissedRuns
  }

  const latestExecutionMillisByFlowId = await fetchLatestExecutionTimes(
    missingFlowIds,
    getLookBackStartMillis(nowMillis),
  )
  const missingMissedRuns = missingFlowIds.flatMap((flowId) => {
    const pipe = pipeByFlowId.get(flowId)
    if (!pipe) {
      return []
    }

    return listPipeMissedRuns(pipe, (pattern) =>
      findMissingPipeMissedRuns({
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
  })

  return [...overdueMissedRuns, ...missingMissedRuns]
}
