import ioRedis from 'ioredis'

import logger from '@/helpers/logger'

import appConfig from './app'

const redisDbOffset = Number(process.env.REDIS_DB_OFFSET ?? 0)

// Maximum of 16 logical DBs on a default Redis instance; integration tests start
// Redis with 256 and assign each worker its own contiguous block via REDIS_DB_OFFSET.
export const REDIS_DB_INDEX = {
  JOBS: redisDbOffset + 0,
  RATE_LIMIT: redisDbOffset + 1,
  PIPE_ERRORS: redisDbOffset + 2,
  APP_DATA: redisDbOffset + 3,
} as const

function reconnectOnError(err: Error) {
  const targetError = 'READONLY'
  logger.error('Redis connection error', err)
  if (err.message.includes(targetError)) {
    // Only reconnect when the error contains "READONLY"
    // during node failover, this is thrown: 149: -READONLY You can't write against a read only replica.
    // Using reconnectOnError, we can force the connection to reconnect on this error in order to connect to the new master.
    // We return 2 so that ioredis will resend the failed command after reconnecting.
    return 2
  }
  return false
}

/**
 * TODO:
 * database index is actually not supported in cluster mode
 * it automatically uses the database index 0.
 * We should be using prefixes instead.
 */
export const createRedisClient = (db = REDIS_DB_INDEX.JOBS) =>
  appConfig.redisClusterMode
    ? new ioRedis.Cluster(
        [
          {
            host: appConfig.redisHost,
            port: appConfig.redisPort,
          },
        ],
        {
          dnsLookup: (address, callback) => callback(null, address),
          redisOptions: {
            tls: appConfig.redisTls ? {} : undefined,
            username: appConfig.redisUsername,
            password: appConfig.redisPassword,
            db,
            reconnectOnError,
          },
        },
      )
    : new ioRedis({
        host: appConfig.redisHost,
        port: appConfig.redisPort,
        tls: appConfig.redisTls ? {} : undefined,
        username: appConfig.redisUsername,
        password: appConfig.redisPassword,
        enableReadyCheck: false,
        maxRetriesPerRequest: null, // commands wait forever until the connection is alive again.
        db,
        reconnectOnError,
      })
