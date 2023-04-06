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
        maxRetriesPerRequest: null,
      })
