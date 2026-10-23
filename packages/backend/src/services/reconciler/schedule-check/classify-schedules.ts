// Members are `flow-<id>` since bullmq 5.70.2, or `flow-<id>:<id>:::<cron>` for pipes published under 5.7.8.
const SCHEDULE_ENTRY_MEMBER_REGEX =
  /^flow-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::|$)/i

/**
 * Maps each flow ID to its next run time, from a `ZRANGE ... WITHSCORES` reply.
 */
export function parseScheduleEntries(
  zrangeWithScores: string[],
): Map<string, number> {
  const nextRunTimeByFlowId = new Map<string, number>()

  for (let i = 0; i + 1 < zrangeWithScores.length; i += 2) {
    const match = SCHEDULE_ENTRY_MEMBER_REGEX.exec(zrangeWithScores[i])
    if (!match) {
      continue
    }

    const flowId = match[1]
    const runTimeMillis = Number(zrangeWithScores[i + 1])
    // A leftover entry from the older member format must not hide a healthy one.
    const existing = nextRunTimeByFlowId.get(flowId)
    if (existing === undefined || runTimeMillis > existing) {
      nextRunTimeByFlowId.set(flowId, runTimeMillis)
    }
  }

  return nextRunTimeByFlowId
}

interface ClassifySchedulesInput {
  publishedFlowIds: string[]
  nextRunTimeByFlowId: Map<string, number>
  nowMillis: number
  graceSeconds: number
}

export interface ScheduleClassification {
  missingFlowIds: string[]
  overdueFlowIds: string[]
}

export function classifySchedules({
  publishedFlowIds,
  nextRunTimeByFlowId,
  nowMillis,
  graceSeconds,
}: ClassifySchedulesInput): ScheduleClassification {
  const overdueBeforeMillis = nowMillis - graceSeconds * 1000
  const missingFlowIds: string[] = []
  const overdueFlowIds: string[] = []

  for (const flowId of publishedFlowIds) {
    const nextRunTimeMillis = nextRunTimeByFlowId.get(flowId)
    if (nextRunTimeMillis === undefined) {
      missingFlowIds.push(flowId)
    } else if (nextRunTimeMillis < overdueBeforeMillis) {
      overdueFlowIds.push(flowId)
    }
  }

  return { missingFlowIds, overdueFlowIds }
}
