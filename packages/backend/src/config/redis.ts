import iosRedis from 'ioredis'

import appConfig from './app'

const redisConfig = appConfig.redisClusterMode
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
    })

export default redisConfig
