import { DateTime } from 'luxon'

import { client } from '@/config/database'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

const redisClient = createRedisClient(REDIS_DB_INDEX.PLUMBER_DATA)

const getPlumberStats = async () => {
  const redisKey = 'plumber-data'

  if (await redisClient.exists(redisKey)) {
    return {
      userCount: await redisClient.hget(redisKey, 'userCount'),
      executionCount: await redisClient.hget(redisKey, 'executionCount'),
    }
  }

  const userCountQuery = await client.raw(
    `SELECT reltuples AS estimate FROM pg_class WHERE relname = 'users';`,
  )
  const userCount = userCountQuery.rows[0].estimate
  const executionCountQuery = await client.raw(
    `SELECT reltuples AS estimate FROM pg_class WHERE relname = 'executions';`,
  )
  const executionCount = executionCountQuery.rows[0].estimate

  await redisClient
    .multi()
    .hset(redisKey, {
      userCount,
      executionCount,
    })
    .pexpireat(redisKey, DateTime.now().endOf('day').toMillis())
    .exec()

  return {
    userCount,
    executionCount,
  }
}

export default getPlumberStats
