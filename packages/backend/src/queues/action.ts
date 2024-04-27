import type { IActionJobData } from '@plumber/types'

import {
  type JobPro,
  type JobsProOptions,
  type QueuePro,
} from '@taskforcesh/bullmq-pro'

import apps from '@/apps'
import { makeActionQueue } from '@/helpers/queues/make-action-queue'

//
// Queue storage
// ---
// These should only be referenced during setup, debugging and tests.
//

// Main action queue
// Note: Queue naming convention is a little different for legacy reasons.
export const MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX = '{actionQ}'
export const MAIN_ACTION_QUEUE_NAME = 'action'

export const mainActionQueue = makeActionQueue({
  queueName: MAIN_ACTION_QUEUE_NAME,
  redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
})

// App-specific action queues
export const appActionQueues: Record<
  keyof typeof apps,
  ReturnType<typeof makeActionQueue>
> = Object.create(null)
for (const [appKey, app] of Object.entries(apps)) {
  if (!app.queue) {
    continue
  }
  appActionQueues[appKey] = makeActionQueue({
    queueName: `{app-actions-${appKey}}`,
  })
}

//
// Queue manipulation API
// ---
// Use these functions during actual operation.
//

interface EnqueueActionJobParams {
  appKey: string | null
  jobName: string
  jobData: IActionJobData
  jobOptions: Omit<JobsProOptions, 'group'>
}

export async function enqueueActionJob({
  appKey,
  jobName,
  jobData,
  jobOptions,
}: EnqueueActionJobParams): Promise<JobPro<IActionJobData>> {
  if (!(appKey in appActionQueues)) {
    return await mainActionQueue.add(jobName, jobData, jobOptions)
  }

  const appQueue = appActionQueues[appKey]
  const groupConfig = await apps[appKey].queue.getGroupConfigForJob?.(jobData)

  return await appQueue.add(jobName, jobData, {
    ...jobOptions,
    ...(groupConfig ? { group: groupConfig } : {}),
  })
}

interface GetJobParams {
  appKey: string
  jobId: string
}

export async function getJob({
  appKey,
  jobId,
}: GetJobParams): Promise<ReturnType<QueuePro<IActionJobData>['getJob']>> {
  if (!(appKey in appActionQueues)) {
    return await mainActionQueue.getJob(jobId)
  }

  return await appActionQueues[appKey].getJob(jobId)
}
