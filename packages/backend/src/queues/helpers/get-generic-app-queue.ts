import type { IAppQueue } from '@plumber/types'

import { QUEUE_CONCURRENCY } from '@/config/queues'

/**
 * NOTE: this creates a generic queue for apps that do not require
 * any special queue configuration.
 * It adds a generic group id to the jobs to ensure that the
 * concurrency limit is applied.
 */
export function getGenericAppQueue(
  app: keyof typeof QUEUE_CONCURRENCY,
): IAppQueue {
  const concurrency = QUEUE_CONCURRENCY[app] || 2

  const getGroupConfigForJob = async () => {
    return { id: app }
  }

  return {
    getGroupConfigForJob,
    groupLimits: {
      type: 'concurrency',
      concurrency: concurrency,
    },
    isQueueDelayable: false,
  } satisfies IAppQueue
}
