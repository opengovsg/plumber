/* oxlint-disable no-console */
import { beforeEach } from 'vitest'

import { ensureWorkerIsolation } from './helpers/worker-isolation'

await ensureWorkerIsolation()

const { createRedisClient, REDIS_DB_INDEX } =
  await import('../src/config/redis')

const redisClients = [...new Set(Object.values(REDIS_DB_INDEX))].map((db) =>
  createRedisClient(db),
)

beforeEach(async () => {
  await Promise.all(redisClients.map((client) => client.flushdb()))
  console.info('vite: Redis flushed')
})
