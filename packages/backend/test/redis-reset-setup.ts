/* oxlint-disable no-console */
import { beforeEach } from 'vitest'

import {
  ensureWorkerIsolation,
  workerRedisDbCount,
} from './helpers/worker-isolation'

await ensureWorkerIsolation()

const { createRedisClient } = await import('../src/config/redis')

const redisDbOffset = Number(process.env.REDIS_DB_OFFSET ?? 0)
const redisClients = Array.from({ length: workerRedisDbCount }, (_, index) =>
  createRedisClient(redisDbOffset + index),
)

beforeEach(async () => {
  await Promise.all(redisClients.map((client) => client.flushdb()))
  console.info('vite: Redis flushed')
})
