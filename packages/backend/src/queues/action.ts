import type { IActionBatchQueue, IActionJobData } from '@plumber/types'

import {
  type JobPro,
  type JobsProOptions,
  type QueuePro,
} from '@taskforcesh/bullmq-pro'

import apps from '@/apps'
import {
  M365_EXCEL_BATCH_ROLLOUT_ALL,
  M365_EXCEL_BATCH_ROLLOUT_FLAG,
  M365_EXCEL_BATCH_ROLLOUT_OFF,
  M365_EXCEL_BATCH_ROLLOUT_OGP,
} from '@/config/flags'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
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
}

// Action batch queues
// ---
// An action may opt into BullMQ Pro batch processing by declaring a `batch`
// config (see IActionBatchQueue / IBaseAction.batch). Jobs for such actions are
// routed to a dedicated per-app batch queue instead of the per-app / main
// action queue, where a batch worker collapses many jobs into one operation.
//
// The batch queues are registered in actionQueuesByName as well, so that
// getActionJob / parseActionJobId can resolve a batched job's jobId back to its
// queue (e.g. for bulk-retry, which re-enqueues from a stored jobId).
export const actionBatchQueues: Record<
  string,
  ReturnType<typeof makeActionQueue>
> = Object.create(null)

// Routing lookup: appKey -> (actionKey -> batch config). Precomputed once at
// module load so enqueueActionJob can route without any extra DB query.
const batchActionsByAppKey = new Map<string, Map<string, IActionBatchQueue>>()

for (const [appKey, app] of Object.entries(apps)) {
  const batchActions = (app.actions ?? []).filter((action) => action.batch)
  if (batchActions.length === 0) {
    continue
  }

  const queueName = `{app-actions-${appKey}-batch}`
  const queue = makeActionQueue({
    queueName,
  })

  actionQueuesByName[queueName] = queue
  actionBatchQueues[appKey] = queue

  const actionsByKey = new Map<string, IActionBatchQueue>()
  for (const action of batchActions) {
    actionsByKey.set(action.key, action.batch)
  }
  batchActionsByAppKey.set(appKey, actionsByKey)
}

//
// Queue manipulation API
// ---
// Use these functions during actual operation.
//

/**
 * Resolves the staged batch-rollout flag and, for 'ogp', restricts routing to
 * flows owned by an @open.gov.sg user. The DB lookup only runs for 'ogp' (and
 * only for m365-excel's createTableRow, the only batch action today), so 'all'
 * and 'off' - the expected steady states - never pay for it.
 *
 * IMPORTANT: unlike a plain flag-value mismatch (which getLdFlagValue itself
 * falls back on), a LaunchDarkly client/network failure rejects the promise.
 * Falling back to the pre-flag 'all' behaviour here keeps that from failing
 * every action enqueue.
 */
async function shouldRouteToBatchQueue(
  appKey: string,
  actionKey: string,
  jobData: IActionJobData,
): Promise<boolean> {
  let rollout: string
  try {
    rollout = await getLdFlagValue<string>(
      M365_EXCEL_BATCH_ROLLOUT_FLAG,
      null,
      M365_EXCEL_BATCH_ROLLOUT_ALL,
    )
  } catch (error) {
    logger.error({
      event: 'm365-excel-batch-rollout-flag-lookup-failed',
      message: (error as Error).message,
    })
    return true
  }

  if (rollout === M365_EXCEL_BATCH_ROLLOUT_OFF) {
    return false
  }

  if (rollout === M365_EXCEL_BATCH_ROLLOUT_ALL) {
    return true
  }

  if (
    rollout === M365_EXCEL_BATCH_ROLLOUT_OGP &&
    appKey === 'm365-excel' &&
    actionKey === 'createTableRow'
  ) {
    const flow = await Flow.query()
      .findById(jobData.flowId)
      .withGraphFetched('user')
    return flow?.user?.email.toLowerCase().endsWith('@open.gov.sg') ?? false
  }

  return false
}

interface EnqueueActionJobParams {
  appKey: string | null
  actionKey: string | null
  jobName: string
  jobData: IActionJobData
  jobOptions: Omit<JobsProOptions, 'group'>
}

export async function enqueueActionJob({
  appKey,
  actionKey,
  jobName,
  jobData,
  jobOptions,
}: EnqueueActionJobParams): Promise<JobPro<IActionJobData>> {
  // Route batch-enabled actions to their dedicated batch queue. This takes
  // precedence over the per-app / main queue, gated by a staged rollout flag:
  // 'off' falls through to the per-app queue below (the pre-batching path)
  // for everyone, 'ogp' further restricts routing to flows owned by an OGP
  // user (internal dogfooding), and 'all' routes every flow.
  const batchConfig =
    appKey && actionKey
      ? batchActionsByAppKey.get(appKey)?.get(actionKey)
      : undefined

  if (
    batchConfig &&
    (await shouldRouteToBatchQueue(appKey, actionKey, jobData))
  ) {
    const batchQueue = actionBatchQueues[appKey]
    const groupConfig = await batchConfig.getGroupConfigForJob(jobData)

    return await batchQueue.add(jobName, jobData, {
      ...jobOptions,
      ...(groupConfig ? { group: groupConfig } : {}),
    })
  }

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
