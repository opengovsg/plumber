import IORedis from 'ioredis'

import {
  SCHEDULER_DEFAULT_INTERVAL_IN_MS,
  SCHEDULER_MAX_DELAY_IN_MS,
} from '@/apps/scheduler/common/constants'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import Flow from '@/models/flow'
import triggerQueue from '@/queues/trigger'
import { processFlow } from '@/services/flow'

const redis = new IORedis()

export async function acquireCoordinationLock(
  timestamp: string,
): Promise<boolean> {
  const key = `buffer-lock:${timestamp}`
  const lock = await redis.set(key, '1', 'PX', SCHEDULER_MAX_DELAY_IN_MS, 'NX')
  return lock === 'OK'
}

/**
 * Calculate the delays for a given number of jobs.
 * Jobs are spread out evenly over the max delay.
 * @param count - The number of jobs
 * @returns An array of delays in milliseconds
 */
export function calculateDelays(count: number) {
  if (count <= 1) {
    return [0]
  }

  const maxJobsWithDefaultSpacing =
    Math.floor(SCHEDULER_MAX_DELAY_IN_MS / SCHEDULER_DEFAULT_INTERVAL_IN_MS) + 1

  if (count <= maxJobsWithDefaultSpacing) {
    // Use default interval (e.g., 5 minutes apart)
    return Array.from(
      { length: count },
      (_, i) => i * SCHEDULER_DEFAULT_INTERVAL_IN_MS,
    )
  }

  // Not enough space → fall back to evenly distributed spacing
  const interval = Math.floor(SCHEDULER_MAX_DELAY_IN_MS / (count - 1))
  return Array.from({ length: count }, (_, i) => i * interval)
}

export async function moveJobToTriggerQueue(flowId: string, delay: number) {
  const flow = await Flow.query().findById(flowId).throwIfNotFound()
  const triggerStep = await flow.getTriggerStep()

  const { data, error } = await processFlow({ flowId })

  const reversedData = data.reverse()

  const jobOptions = {
    delay,
    removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
    removeOnFail: REMOVE_AFTER_30_DAYS,
  }

  for (const triggerItem of reversedData) {
    const jobName = `${triggerStep.id}-${triggerItem.meta.internalId}`

    const jobPayload = {
      flowId,
      stepId: triggerStep.id,
      triggerItem,
    }

    await triggerQueue.add(jobName, jobPayload, jobOptions)
  }

  if (error) {
    const jobName = `${triggerStep.id}-error`

    const jobPayload = {
      flowId,
      stepId: triggerStep.id,
      error,
    }

    await triggerQueue.add(jobName, jobPayload, jobOptions)
  }
}
