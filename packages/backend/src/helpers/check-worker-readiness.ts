import Redis from 'ioredis'

import redisConfig from '../config/redis'

import logger from './logger'

const redisClient = new Redis(redisConfig)

redisClient.on('ready', () => {
  logger.info(`Workers are ready!`)

  redisClient.disconnect()
})
