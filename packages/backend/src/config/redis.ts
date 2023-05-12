import iosRedis from 'ioredis'

import appConfig from './app'

export const createRedisClient = () =>
  appConfig.redisClusterMode
    ? new iosRedis.Cluster(
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
          },
        },
      )
    : new iosRedis({
        host: appConfig.redisHost,
        port: appConfig.redisPort,
        tls: appConfig.redisTls ? {} : undefined,
        username: appConfig.redisUsername,
        password: appConfig.redisPassword,
        enableReadyCheck: false,
        maxRetriesPerRequest: null, // commands wait forever until the connection is alive again.
        reconnectOnError(err) {
          const targetError = 'READONLY'
          if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            // during node failover, this is thrown: 149: -READONLY You can't write against a read only replica.
            return true
          }
        },
      })
