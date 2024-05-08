import apps from '@/apps'
import { makeActionWorker } from '@/workers/helpers/make-action-worker'
import {
  appActionQueues,
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'

//
// Worker Storage
// ---
// These should only be referenced during setup, debugging and tests.
//

// Worker for our main action queue
export const mainActionWorker = makeActionWorker({
  queueName: MAIN_ACTION_QUEUE_NAME,
  redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
  queueConfig: {
    isQueueDelayable: false,
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

  appActionWorkers[appKey] = makeActionWorker({
    queueName: appActionQueues[appKey].name,
    queueConfig: app.queue,
  })
}
