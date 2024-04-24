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
// These should only be used for debugging and tests
//

// Default queue
export const defaultActionQueue = makeActionQueue()

// App-specific queues
export const appActionQueues = new Map<
  keyof typeof apps,
  ReturnType<typeof makeActionQueue>
>()
for (const [appKey, app] of Object.entries(apps)) {
  if (!app.queue) {
    continue
  }
  appActionQueues.set(appKey, makeActionQueue({ appKey }))
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
  if (!appActionQueues.has(appKey)) {
    return await defaultActionQueue.add(jobName, jobData, jobOptions)
  }

  const appQueue = appActionQueues.get(appKey)
  const groupConfig = await apps[appKey].queue.getGroupConfigForJob(jobData)

  return await appQueue.add(jobName, jobData, {
    ...jobOptions,
    group: groupConfig,
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
  if (!appActionQueues.has(appKey)) {
    return await defaultActionQueue.getJob(jobId)
  }

  const appQueue = appActionQueues.get(appKey)
  return await appQueue.getJob(jobId)
}
