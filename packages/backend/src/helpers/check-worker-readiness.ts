import redisConfig from '../config/redis'

import logger from './logger'

const redisClient = redisConfig

redisClient.on('ready', () => {
  logger.info(`Workers are ready!`)
})
