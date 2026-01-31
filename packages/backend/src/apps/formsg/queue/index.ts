import type { IAppQueue } from '@plumber/types'

/**
 * Just a separate queue for mrf actions so we could implement a different worker for it
 */
const queueSettings = {
  isQueueDelayable: false,
  workerType: 'sub-trigger',
} satisfies IAppQueue

export default queueSettings
