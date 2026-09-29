import apps from '@/apps'
import logger from '@/helpers/logger'
import {
  actionBatchQueues,
  appActionQueues,
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'
import { makeActionBatchWorker } from '@/workers/helpers/make-action-batch-worker'
import { makeActionWorker } from '@/workers/helpers/make-action-worker'

import { makeSubTriggerWorker } from './helpers/make-sub-trigger-worker'

//
// Worker Storage
// ---
// These should only be referenced during setup, debugging and tests.
//

// Worker for our main action queue
export const mainActionWorker = makeActionWorker({
  appKey: MAIN_ACTION_QUEUE_NAME,
  queueName: MAIN_ACTION_QUEUE_NAME,
  redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
  queueConfig: {
    isQueueDelayable: false,
    workerType: 'action',
  },
})

// Workers for app-specific action queues
export const appActionWorkers: Record<
  keyof typeof apps,
  ReturnType<typeof makeActionWorker>
> = Object.create(null)
for (const [appKey, app] of Object.entries(apps)) {
  if (!app.queue) {
    continue
  }

  if (app.queue.workerType === 'sub-trigger') {
    appActionWorkers[appKey] = makeSubTriggerWorker({
      appKey,
      queueName: appActionQueues[appKey].name,
    })
  } else {
    appActionWorkers[appKey] = makeActionWorker({
      appKey,
      queueName: appActionQueues[appKey].name,
      queueConfig: app.queue,
    })
  }
}

// Batch workers for apps with batch-enabled actions. These consume the
// per-app batch queues created in queues/action.ts (`{app-actions-<key>-batch}`)
// and collapse many jobs of a batch-enabled action into one multi-row operation.
export const appActionBatchWorkers: Record<
  keyof typeof apps,
  ReturnType<typeof makeActionBatchWorker>
> = Object.create(null)
for (const [appKey, app] of Object.entries(apps)) {
  const batchQueue = actionBatchQueues[appKey]
  if (!batchQueue) {
    continue
  }

  // All batch-enabled actions in an app share its single batch queue/worker;
  // the queue-level config (rate limit) is taken from the first such action.
  const batchConfig = (app.actions ?? []).find((action) => action.batch)?.batch
  if (!batchConfig) {
    continue
  }

  appActionBatchWorkers[appKey] = makeActionBatchWorker({
    appKey,
    queueName: batchQueue.name,
    batchConfig,
  })
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM: gracefully closing all action workers')
  const allWorkers = [
    mainActionWorker,
    ...Object.values(appActionWorkers),
    ...Object.values(appActionBatchWorkers),
  ]
  await Promise.all(allWorkers.map((w) => w?.close()))
  logger.info('SIGTERM: all action workers closed')
})
