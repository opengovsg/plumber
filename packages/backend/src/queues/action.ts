import { QueuePro } from '@taskforcesh/bullmq-pro'
import process from 'process'

import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'

const CONNECTION_REFUSED = 'ECONNREFUSED'

const redisConnection = {
  prefix: '{actionQ}',
  connection: createRedisClient(),
}

const actionQueue = new QueuePro('action', redisConnection)

process.on('SIGTERM', async () => {
  await actionQueue.close()
})

actionQueue.on('error', (err) => {
  if ((err as any).code === CONNECTION_REFUSED) {
    logger.error('Make sure you have installed Redis and it is running.', err)
    process.exit()
  }
})

export default actionQueue
