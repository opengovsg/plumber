import { createRedisClient } from '@/config/redis'

import logger from './logger'

const redisClient = createRedisClient()

redisClient.on('ready', () => {
  logger.info(`Workers are ready!`)
  redisClient.disconnect()
})
