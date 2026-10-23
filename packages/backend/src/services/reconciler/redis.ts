import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

/**
 * Avoids `@/queues/flow`, whose exit-on-refused handler would kill the process during a Redis outage.
 */
export function createReconcilerRedisClient(): ReturnType<
  typeof createRedisClient
> {
  const client = createRedisClient(REDIS_DB_INDEX.JOBS)

  // ioredis prints unlistened 'error' events to stderr, outside our JSON logs.
  client.on('error', (error) => {
    logger.error('Reconciler Redis connection error', {
      event: 'reconciler-redis-error',
      error,
    })
  })

  return client
}
