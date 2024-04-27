import { IActionJobData } from '@plumber/types'

import { QueuePro, type QueueProOptions } from '@taskforcesh/bullmq-pro'
import process from 'process'

import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'

const CONNECTION_REFUSED = 'ECONNREFUSED'

interface MakeActionQueueParams {
  queueName: string
  redisConnectionPrefix?: string
}

export function makeActionQueue(
  params: MakeActionQueueParams,
): QueuePro<IActionJobData> {
  const { queueName, redisConnectionPrefix } = params

  const queueOptions: QueueProOptions = { connection: createRedisClient() }
  if (redisConnectionPrefix) {
    queueOptions.prefix = redisConnectionPrefix
  }
  const queue = new QueuePro(queueName, queueOptions)

  queue.on('error', (err) => {
    if ((err as any).code === CONNECTION_REFUSED) {
      logger.error('Make sure you have installed Redis and it is running.', err)
      process.exit()
    }
  })

  process.on('SIGTERM', async () => {
    await queue.close()
  })

  return queue
}
