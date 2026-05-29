import apps from '@/apps'
import logger from '@/helpers/logger'
import {
  appActionQueues,
  appBatchActionQueues,
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'
import { makeActionWorker } from '@/workers/helpers/make-action-worker'
import { makeBatchActionWorker } from '@/workers/helpers/make-batch-action-worker'

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

// Workers for app-specific batch action queues. Only populated for apps that
// opt into batching (flag-gated); keyed by appKey.
export const appBatchActionWorkers: Record<
  string,
  ReturnType<typeof makeBatchActionWorker>
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

  // Flag-gated: a batch queue only exists when the app opts into batching, so a
  // matching batch worker is created only then. Flag off => no batch worker.
  if (app.queue.batch && appKey in appBatchActionQueues) {
    appBatchActionWorkers[appKey] = makeBatchActionWorker({
      appKey,
      queueName: appBatchActionQueues[appKey].name,
      queueConfig: app.queue,
    })
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM: gracefully closing all action workers')
  const allWorkers = [
    mainActionWorker,
    ...Object.values(appActionWorkers),
    ...Object.values(appBatchActionWorkers),
  ]
  await Promise.all(allWorkers.map((w) => w?.close()))
  logger.info('SIGTERM: all action workers closed')
})
