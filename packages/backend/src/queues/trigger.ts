import process from 'process'

import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'
import { QueuePro } from '@/lib/bullmq-pro-compat'

const CONNECTION_REFUSED = 'ECONNREFUSED'

const redisConnection = {
  prefix: '{triggerQ}',
  connection: createRedisClient(),
}

const triggerQueue = new QueuePro('trigger', redisConnection)

process.on('SIGTERM', async () => {
  await triggerQueue.close()
})

triggerQueue.on('error', (err) => {
  if ((err as any).code === CONNECTION_REFUSED) {
    logger.error('Make sure you have installed Redis and it is running.', err)
    process.exit()
  }
})

export default triggerQueue
