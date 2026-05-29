import type { IActionJobData } from '@plumber/types'

import {
  type JobPro,
  type JobsProOptions,
  type QueuePro,
} from '@taskforcesh/bullmq-pro'

import apps from '@/apps'
import logger from '@/helpers/logger'
import Step from '@/models/step'
import { makeActionQueue } from '@/queues/helpers/make-action-queue'

//
// Queue storage
// ---
// These should only be referenced during setup, debugging and tests.
//

// Allow quickly looking up a queue by its name (e.g. when getting jobs)
export const actionQueuesByName: Record<
  string,
  ReturnType<typeof makeActionQueue>
> = Object.create(null)

// Main action queue
// Note: Queue naming convention is a little different for legacy reasons.
export const MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX = '{actionQ}'
export const MAIN_ACTION_QUEUE_NAME = 'action'

export const mainActionQueue = makeActionQueue({
  queueName: MAIN_ACTION_QUEUE_NAME,
  redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
})
actionQueuesByName[MAIN_ACTION_QUEUE_NAME] = mainActionQueue

// App-specific action queues
export const appActionQueues: Record<
  keyof typeof apps,
  ReturnType<typeof makeActionQueue>
> = Object.create(null)

// Dedicated batch action queues, keyed by appKey. Only populated for apps whose
// queue config sets `batch` (flag-gated). Batchable action keys are routed here
// instead of the app's regular queue; see enqueueActionJob below.
export const appBatchActionQueues: Record<
  string,
  ReturnType<typeof makeActionQueue>
> = Object.create(null)

for (const [appKey, app] of Object.entries(apps)) {
  if (!app.queue) {
    continue
  }

  const queueName = `{app-actions-${appKey}}`
  const queue = makeActionQueue({
    queueName,
  })

  actionQueuesByName[queueName] = queue
  appActionQueues[appKey] = queue

  // Register the dedicated batch queue when the app opts in. Adding it to
  // actionQueuesByName is what lets getActionJob resolve retries of batch-queue
  // jobs (their jobId encodes the batch queue name) - no schema change needed.
  if (app.queue.batch) {
    const batchQueueName = `{app-actions-${appKey}-batch}`
    const batchQueue = makeActionQueue({
      queueName: batchQueueName,
    })

    actionQueuesByName[batchQueueName] = batchQueue
    appBatchActionQueues[appKey] = batchQueue
  }
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
  const batchConfig = apps[appKey].queue.batch
  const batchQueue = appBatchActionQueues[appKey]

  // Route batchable action keys to the dedicated batch queue (with its finer
  // grouping). We need the step's key to decide, so fetch the Step here; the
  // chosen group helper re-reads it - an accepted redundant indexed lookup,
  // mirroring the existing worker -> processAction double-read.
  if (batchConfig && batchQueue) {
    const step = await Step.query().findById(jobData.stepId).throwIfNotFound()

    if (batchConfig.actionKeys.includes(step.key)) {
      const batchGroupConfig = await batchConfig.getGroupConfigForJob(jobData)

      return await batchQueue.add(jobName, jobData, {
        ...jobOptions,
        ...(batchGroupConfig ? { group: batchGroupConfig } : {}),
      })
    }
  }

  const groupConfig = await apps[appKey].queue.getGroupConfigForJob?.(jobData)

  return await appQueue.add(jobName, jobData, {
    ...jobOptions,
    ...(groupConfig ? { group: groupConfig } : {}),
  })
}

/**
 * This is stored in the "jobId" column in our ExecutionStep table - it
 * identifies exactly which queue and the job came from.
 */
export function makeActionJobId(
  queueName: string,
  bullMqJobId: string,
): string {
  // By legacy convention, job IDs in the main queue should just be the BullMQ job ID.
  if (queueName === MAIN_ACTION_QUEUE_NAME) {
    return bullMqJobId
  }

  return `${queueName}:${bullMqJobId}`
}

function parseActionJobId(actionJobId: string): {
  queueName: string
  bullMqJobId: string
} {
  // Legacy convention - jobs in the main action queue do not have ":"
  if (!actionJobId.includes(':')) {
    return {
      queueName: MAIN_ACTION_QUEUE_NAME,
      bullMqJobId: actionJobId,
    }
  }

  const [queueName, bullMqJobId] = actionJobId.split(':')
  return {
    queueName,
    bullMqJobId,
  }
}

/**
 * Gets the BullMQ job associated with an actionJobId. This is _NOT_ the bullMQ
 * job ID - it's the ID that's returned by makeActionJobId. This ID is also
 * stored in the jobId column in our ExecutionStep table
 *
 * @param actionJobId The ID constructed by makeActionJobId (usually stored in
 * the jobId column in the ExecutionStep table).
 */
export async function getActionJob(
  actionJobId: string,
): Promise<ReturnType<QueuePro<IActionJobData>['getJob']>> {
  const { queueName, bullMqJobId } = parseActionJobId(actionJobId)
  return await actionQueuesByName[queueName].getJob(bullMqJobId)
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM: gracefully closing all action queues')
  const allQueues = [mainActionQueue, ...Object.values(actionQueuesByName)]
  await Promise.all(allQueues.map((q) => q?.close()))
  logger.info('SIGTERM: all action queues closed')
})
