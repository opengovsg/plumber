import { QueuePro } from '@taskforcesh/bullmq-pro'
import process from 'process'

import { createRedisClient } from '@/config/redis'
import { isUnitTestRun } from '@/config/unit-test-mode'
import logger from '@/helpers/logger'

const CONNECTION_REFUSED = 'ECONNREFUSED'

const redisConnection = {
  prefix: '{flowQ}',
  connection: createRedisClient(),
}

const flowQueue = new QueuePro('flow', redisConnection)

process.on('SIGTERM', async () => {
  await flowQueue.close()
})

flowQueue.on('error', (err) => {
  if ((err as any).code === CONNECTION_REFUSED) {
    logger.error('Make sure you have installed Redis and it is running.', err)
    if (isUnitTestRun) {
      return
    }
    process.exit()
  }
})

export default flowQueue
