import ioRedis from 'ioredis'

import appConfig from './app'

// Maximum of 16; be careful when adding!
export const REDIS_DB_INDEX = {
  JOBS: 0,
  RATE_LIMIT: 1,
  PIPE_ERRORS: 2,
  APP_DATA: 3,
  PLUMBER_DATA: 4,
}

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
        reconnectOnError(err) {
          const targetError = 'READONLY'
          if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            // during node failover, this is thrown: 149: -READONLY You can't write against a read only replica.
            return true
          }
        },
      })
