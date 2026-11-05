import type { PublishedScheduledPipe } from './fetch-published-scheduled-pipes'

// Members are `flow-<id>` since bullmq 5.70.2, or `flow-<id>:<id>:::<cron>` for pipes published under 5.7.8.
const SCHEDULE_ENTRY_MEMBER_REGEX =
  /^flow-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::|$)/i

export interface ScheduleEntry {
  member: string
  runTimeMillis: number
}

/**
 * Maps each flow ID to its schedule entry, from a `ZRANGE ... WITHSCORES` reply.
 */
export function parseScheduleEntries(
  zrangeWithScores: string[],
): Map<string, ScheduleEntry> {
  const scheduleEntryByFlowId = new Map<string, ScheduleEntry>()

  for (let i = 0; i + 1 < zrangeWithScores.length; i += 2) {
    const member = zrangeWithScores[i]
    const match = SCHEDULE_ENTRY_MEMBER_REGEX.exec(member)
    if (!match) {
      continue
    }

    scheduleEntryByFlowId.set(match[1], {
      member,
      runTimeMillis: Number(zrangeWithScores[i + 1]),
    })
  }

  return scheduleEntryByFlowId
}

interface ClassifySchedulesInput {
  publishedPipes: PublishedScheduledPipe[]
  scheduleEntryByFlowId: Map<string, ScheduleEntry>
  nowMillis: number
  graceSeconds: number
}

export interface OverduePipe {
  pipe: PublishedScheduledPipe
  scheduleEntry: ScheduleEntry
}

export interface ScheduleClassification {
  missingPipes: PublishedScheduledPipe[]
  overduePipes: OverduePipe[]
}

export function classifySchedules({
  publishedPipes,
  scheduleEntryByFlowId,
  nowMillis,
  graceSeconds,
}: ClassifySchedulesInput): ScheduleClassification {
  const overdueBeforeMillis = nowMillis - graceSeconds * 1000

  const missingPipes = publishedPipes.filter(
    (pipe) => !scheduleEntryByFlowId.has(pipe.flowId),
  )
  const overduePipes = publishedPipes.flatMap((pipe) => {
    const scheduleEntry = scheduleEntryByFlowId.get(pipe.flowId)
    return scheduleEntry && scheduleEntry.runTimeMillis < overdueBeforeMillis
      ? [{ pipe, scheduleEntry }]
      : []
  })

  return { missingPipes, overduePipes }
}
