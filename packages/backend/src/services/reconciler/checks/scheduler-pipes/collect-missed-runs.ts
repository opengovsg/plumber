import type { Redis } from 'ioredis'

import logger from '@/helpers/logger'

import type { OverduePipe } from './classify-schedules'
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
  missingPipes: PublishedScheduledPipe[]
  overduePipes: OverduePipe[]
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
  missingPipes,
  overduePipes,
  nowMillis,
  graceSeconds,
}: CollectMissedRunsInput): Promise<MissedRun[]> {
  const overdueMissedRuns: MissedRun[] = []

  // One pipe at a time, so the job queues never wait behind more than one HMGET.
  for (const { pipe, scheduleEntry } of overduePipes) {
    const isNextRunJobPending = await isRunTimeJobPending({
      jobsRedis,
      flowId: pipe.flowId,
      scheduleEntryMember: scheduleEntry.member,
      runTimeMillis: scheduleEntry.runTimeMillis,
    })
    overdueMissedRuns.push(
      ...listPipeMissedRuns(pipe, (pattern) =>
        findOverduePipeMissedRuns({
          flowId: pipe.flowId,
          pattern,
          nextRunTimeMillis: scheduleEntry.runTimeMillis,
          isNextRunJobPending,
          nowMillis,
          graceSeconds,
        }),
      ),
    )
  }

  if (missingPipes.length === 0) {
    return overdueMissedRuns
  }

  const latestExecutionMillisByFlowId = await fetchLatestExecutionTimes(
    missingPipes.map((pipe) => pipe.flowId),
    getLookBackStartMillis(nowMillis),
  )
  const missingMissedRuns = missingPipes.flatMap((pipe) =>
    listPipeMissedRuns(pipe, (pattern) =>
      findMissingPipeMissedRuns({
        flowId: pipe.flowId,
        pattern,
        publishedAtMillis: pipe.publishedAt
          ? new Date(pipe.publishedAt).getTime()
          : 0,
        latestExecutionMillis: latestExecutionMillisByFlowId.get(pipe.flowId),
        nowMillis,
        graceSeconds,
      }),
    ),
  )

  return [...overdueMissedRuns, ...missingMissedRuns]
}
