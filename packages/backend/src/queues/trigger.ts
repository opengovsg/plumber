import { QueuePro } from '@taskforcesh/bullmq-pro'
import process from 'process'

import { createRedisClient } from '@/config/redis'
import { isUnitTestRun } from '@/config/unit-test-mode'
import logger from '@/helpers/logger'

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
    if (isUnitTestRun) {
      return
    }
    process.exit()
  }
})

export default triggerQueue
