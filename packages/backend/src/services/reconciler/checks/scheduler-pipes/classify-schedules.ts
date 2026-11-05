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
  publishedFlowIds: string[]
  scheduleEntryByFlowId: Map<string, ScheduleEntry>
  nowMillis: number
  graceSeconds: number
}

export interface ScheduleClassification {
  missingFlowIds: string[]
  overdueFlowIds: string[]
}

export function classifySchedules({
  publishedFlowIds,
  scheduleEntryByFlowId,
  nowMillis,
  graceSeconds,
}: ClassifySchedulesInput): ScheduleClassification {
  const overdueBeforeMillis = nowMillis - graceSeconds * 1000

  const missingFlowIds = publishedFlowIds.filter(
    (flowId) => !scheduleEntryByFlowId.has(flowId),
  )
  const overdueFlowIds = publishedFlowIds.filter((flowId) => {
    const scheduleEntry = scheduleEntryByFlowId.get(flowId)
    return (
      scheduleEntry !== undefined &&
      scheduleEntry.runTimeMillis < overdueBeforeMillis
    )
  })

  return { missingFlowIds, overdueFlowIds }
}
