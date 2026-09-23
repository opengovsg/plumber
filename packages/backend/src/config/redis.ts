import ioRedis, { type ClusterOptions, type RedisOptions } from 'ioredis'

import logger from '@/helpers/logger'

import appConfig from './app'
import { isUnitTestRun } from './unit-test-mode'

// Maximum of 16; be careful when adding!
export const REDIS_DB_INDEX = {
  JOBS: 0,
  RATE_LIMIT: 1,
  PIPE_ERRORS: 2,
  APP_DATA: 3,
}

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
 * Never dial out, never queue commands, and never schedule a reconnect. A
 * retrying client keeps the vitest worker's event loop busy until tinypool
 * fails to hand it the next test file.
 *
 * IMPORTANT: maxRetriesPerRequest must stay falsy. BullMQ throws on a shared
 * blocking connection that sets it.
 */
const UNIT_TEST_REDIS_OPTIONS = {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
} satisfies RedisOptions

const UNIT_TEST_CLUSTER_OPTIONS = {
  lazyConnect: true,
  clusterRetryStrategy: () => null,
} satisfies ClusterOptions

/**
 * TODO:
 * database index is actually not supported in cluster mode
 * it automatically uses the database index 0.
 * We should be using prefixes instead.
 */
export const createRedisClient = (db = REDIS_DB_INDEX.JOBS) => {
  const client = appConfig.redisClusterMode
    ? new ioRedis.Cluster(
        [
          {
            host: appConfig.redisHost,
            port: appConfig.redisPort,
          },
        ],
        {
          dnsLookup: (address, callback) => callback(null, address),
          ...(isUnitTestRun ? UNIT_TEST_CLUSTER_OPTIONS : {}),
          redisOptions: {
            tls: appConfig.redisTls ? {} : undefined,
            username: appConfig.redisUsername,
            password: appConfig.redisPassword,
            db,
            reconnectOnError,
            ...(isUnitTestRun ? UNIT_TEST_REDIS_OPTIONS : {}),
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
        ...(isUnitTestRun ? UNIT_TEST_REDIS_OPTIONS : {}),
      })

  if (isUnitTestRun) {
    // Without a listener, ioredis logs every refused connection, and vitest
    // ships each log to the parent over the IPC channel that then fails.
    client.on('error', () => undefined)
  }

  return client
}
