import apps from '@/apps'
import { makeActionWorker } from '@/helpers/queues/make-action-worker'

// Default worker
export const defaultActionWorker = makeActionWorker()

// App-specific workers
export const appActionWorkers = new Map<
  keyof typeof apps,
  ReturnType<typeof makeActionWorker>
>()
for (const [appKey, app] of Object.entries(apps)) {
  if (!app.queue) {
    continue
  }

  appActionWorkers.set(appKey, makeActionWorker({ appKey, config: app.queue }))
}
