import { DateTime } from 'luxon'

import { client } from '@/config/database'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

import type { QueryResolvers } from '../__generated__/types.generated'

const redisClient = createRedisClient(REDIS_DB_INDEX.GLOBAL_DATA)
const REDIS_KEY = 'landing-stats'

const getPlumberStats: QueryResolvers['getPlumberStats'] = async () => {
  if (await redisClient.exists(REDIS_KEY)) {
    const { userCount, executionCount } = await redisClient.hgetall(REDIS_KEY)

    return {
      userCount,
      executionCount,
    }
  }

  const [userCountQuery, executionCountQuery] = await Promise.all([
    client.raw(
      `SELECT reltuples AS estimate FROM pg_class WHERE relname = 'users';`,
    ),
    client.raw(`select count(*) from executions where test_run = false;`),
  ])

  const userCount = userCountQuery.rows[0].estimate
  const executionCount = executionCountQuery.rows[0].count

  await redisClient
    .multi()
    .hset(REDIS_KEY, {
      userCount,
      executionCount,
    })
    .pexpireat(REDIS_KEY, DateTime.now().endOf('day').toMillis())
    .exec()

  return {
    userCount,
    executionCount,
  }
}

export default getPlumberStats
