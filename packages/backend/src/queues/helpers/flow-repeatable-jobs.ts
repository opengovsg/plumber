import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'

export const FLOW_REPEATABLE_JOB_NAME = 'flow'

export type FlowRepeatableJobLike = {
  key: string
  id?: string | null
  name?: string | null
}

export function getFlowRepeatableJobName(flowId: string): string {
  return `${FLOW_REPEATABLE_JOB_NAME}-${flowId}`
}

/**
 * BullMQ 5.10+ stopped putting the custom `jobId` on listed jobs.
 * Match leftover 7.8.1 keys as well as post-upgrade keys.
 */
export function isRepeatableJobForFlow(
  job: FlowRepeatableJobLike,
  flowId: string,
): boolean {
  if (job.id === flowId || job.name === getFlowRepeatableJobName(flowId)) {
    return true
  }

  return typeof job.key === 'string' && job.key.includes(flowId)
}

export function flowIdFromRepeatableJob(
  job: FlowRepeatableJobLike,
): string | null {
  if (job.id) {
    return job.id
  }

  if (job.name?.startsWith(`${FLOW_REPEATABLE_JOB_NAME}-`)) {
    return job.name.slice(FLOW_REPEATABLE_JOB_NAME.length + 1) || null
  }

  const legacyMatch = job.key?.match(/^flow-([0-9a-f-]{36})/i)
  if (legacyMatch) {
    return legacyMatch[1]
  }

  return null
}

export async function removeFlowRepeatableJobs(flowId: string): Promise<void> {
  const jobs = await flowQueue.getRepeatableJobs()
  const matching = jobs.filter((job) => isRepeatableJobForFlow(job, flowId))

  for (const job of matching) {
    await flowQueue.removeRepeatableByKey(job.key)
  }
}

export async function reconcileInactiveFlowRepeatableJobs(): Promise<number> {
  await flowQueue.waitUntilReady()
  const jobs = await flowQueue.getRepeatableJobs()
  const flowIds = [
    ...new Set(
      jobs
        .map((job) => flowIdFromRepeatableJob(job))
        .filter((flowId): flowId is string => flowId !== null),
    ),
  ]

  if (flowIds.length === 0) {
    return 0
  }

  const activeFlows = await Flow.query()
    .select('id')
    .whereIn('id', flowIds)
    .where('active', true)
  const activeIds = new Set(activeFlows.map((flow) => flow.id))

  const processedFlowIds = new Set<string>()
  let removed = 0
  for (const job of jobs) {
    const flowId = flowIdFromRepeatableJob(job)
    if (!flowId || activeIds.has(flowId) || processedFlowIds.has(flowId)) {
      continue
    }

    processedFlowIds.add(flowId)
    await removeFlowRepeatableJobs(flowId)
    removed += 1
  }

  if (removed > 0) {
    logger.info(
      'Removed leftover repeatable jobs for inactive or deleted flows',
      {
        event: 'flow-repeatable-jobs-reconciled',
        removed,
      },
    )
  }

  return removed
}
