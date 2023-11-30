import { RateLimiterRedis, RateLimiterUnion } from 'rate-limiter-flexible'

import { m365RateLimits } from '@/config/app-env-vars/m365'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

const redisClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

const graphApiLimiter = new RateLimiterRedis({
  points: m365RateLimits.graphApi.points,
  duration: m365RateLimits.graphApi.durationSeconds,
  keyPrefix: 'm365-graph',
  storeClient: redisClient,
})

const sharePointPerMinuteLimiter = new RateLimiterRedis({
  points: m365RateLimits.sharePointPerMinute.points,
  duration: m365RateLimits.sharePointPerMinute.durationSeconds,
  keyPrefix: 'm365-sharepoint-per-min',
  storeClient: redisClient,
})

const sharePointPerDayLimiter = new RateLimiterRedis({
  points: m365RateLimits.sharePointPerDay.points,
  duration: m365RateLimits.sharePointPerDay.durationSeconds,
  keyPrefix: 'm365-sharepoint-per-min',
  storeClient: redisClient,
})

const excelLimiter = new RateLimiterRedis({
  points: m365RateLimits.excel.points,
  duration: m365RateLimits.excel.durationSeconds,
  keyPrefix: 'm365-excel',
  storeClient: redisClient,
})

export const rateLimiter = new RateLimiterUnion(
  graphApiLimiter,
  sharePointPerMinuteLimiter,
  sharePointPerDayLimiter,
  excelLimiter,
)
