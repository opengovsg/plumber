import type { QueuePro } from '@taskforcesh/bullmq-pro'

import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import flowQueue from '@/queues/flow'

export const FLOW_REPEATABLE_JOB_NAME = 'flow'

export type FlowRepeatableJobLike = {
  key: string
  id?: string | null
  name?: string | null
}

type JobSchedulerQueue = {
  removeJobScheduler: (schedulerId: string) => Promise<unknown>
  getJobSchedulers: () => Promise<FlowRepeatableJobLike[]>
}

export function getFlowRepeatableJobName(flowId: string): string {
  return `${FLOW_REPEATABLE_JOB_NAME}-${flowId}`
}

function asJobSchedulerQueue(queue: QueuePro): JobSchedulerQueue | null {
  const candidate = queue as QueuePro & Partial<JobSchedulerQueue>
  if (typeof candidate.removeJobScheduler !== 'function') {
    return null
  }
  return candidate as JobSchedulerQueue
}

/**
 * BullMQ 5.10+ (bullmq-pro 7.44) stopped putting the custom `jobId` on
 * listed jobs. Match every leftover key format so unpublish still works.
 */
export function isRepeatableJobForFlow(
  job: FlowRepeatableJobLike,
  flowId: string,
): boolean {
  if (
    job.id === flowId ||
    job.name === getFlowRepeatableJobName(flowId) ||
    job.key === flowId
  ) {
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

async function listRepeatableJobs(
  queue: QueuePro,
): Promise<FlowRepeatableJobLike[]> {
  const jobs = await queue.getRepeatableJobs()
  const byKey = new Map<string, FlowRepeatableJobLike>(
    jobs.map((job) => [job.key, job]),
  )

  const schedulerQueue = asJobSchedulerQueue(queue)
  if (schedulerQueue) {
    const schedulers = await schedulerQueue.getJobSchedulers()
    for (const scheduler of schedulers) {
      if (!byKey.has(scheduler.key)) {
        byKey.set(scheduler.key, scheduler)
      }
    }
  }

  return [...byKey.values()]
}

export async function addFlowRepeatableJob(
  flowId: string,
  pattern: string,
): Promise<void> {
  await flowQueue.add(
    getFlowRepeatableJobName(flowId),
    { flowId },
    {
      // Custom repeat.key is a 5.10+ feature. Setting it on 7.8.1 changes
      // delayed job ids without changing the zset member, so removal misses
      // the already-scheduled job.
      repeat: { pattern },
      jobId: flowId,
      removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
      removeOnFail: REMOVE_AFTER_30_DAYS,
    },
  )
}

export async function removeFlowRepeatableJobs(flowId: string): Promise<void> {
  const jobs = await listRepeatableJobs(flowQueue)
  const matching = jobs.filter((job) => isRepeatableJobForFlow(job, flowId))
  const keys = new Set(matching.map((job) => job.key))
  keys.add(flowId)

  for (const key of keys) {
    await flowQueue.removeRepeatableByKey(key)
  }

  const schedulerQueue = asJobSchedulerQueue(flowQueue)
  if (schedulerQueue) {
    for (const key of keys) {
      await schedulerQueue.removeJobScheduler(key)
    }
  }
}

export async function reconcileInactiveFlowRepeatableJobs(): Promise<number> {
  await flowQueue.waitUntilReady()
  const jobs = await listRepeatableJobs(flowQueue)
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
