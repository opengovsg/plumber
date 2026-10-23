import type { EventEmitter } from 'events'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

// ioredis prints unlistened 'error' events to stderr, outside our JSON logs.
export function logReconcilerRedisErrors(client: EventEmitter): void {
  client.on('error', (error) => {
    logger.error('Reconciler Redis connection error', {
      event: 'reconciler-redis-error',
      error,
    })
  })
}

/**
 * Avoids `@/queues/flow`, whose exit-on-refused handler would kill the process during a Redis outage.
 */
export function createReconcilerRedisClient(): ReturnType<
  typeof createRedisClient
> {
  const client = createRedisClient(REDIS_DB_INDEX.JOBS)
  logReconcilerRedisErrors(client)
  return client
}
