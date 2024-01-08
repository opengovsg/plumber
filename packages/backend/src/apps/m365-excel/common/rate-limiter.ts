import type { IGlobalVariable } from '@plumber/types'

import {
  type IRateLimiterRedisOptions,
  RateLimiterRedis,
  RateLimiterRes,
  RateLimiterUnion,
} from 'rate-limiter-flexible'

import { M365TenantKey } from '@/config/app-env-vars/m365'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import logger from '@/helpers/logger'

// Based on agreement with Govtech team. For simplicity, we'll apply the same
// rate limits to all other tenants.
const M365_RATE_LIMITS = Object.freeze({
  graphApi: {
    points: 13000,
    durationSeconds: 10,
  },
  sharePointPerMinute: {
    points: 300,
    durationSeconds: 60,
  },
  sharePointPerDay: {
    points: 300000,
    durationSeconds: 60 * 60 * 24,
  },
  excel: {
    points: 150,
    durationSeconds: 10,
  },
})

const redisClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

const graphApiLimiter = new RateLimiterRedis({
  points: M365_RATE_LIMITS.graphApi.points,
  duration: M365_RATE_LIMITS.graphApi.durationSeconds,
  keyPrefix: 'm365-graph',
  storeClient: redisClient,
})

const sharePointPerMinuteLimiter = new RateLimiterRedis({
  points: M365_RATE_LIMITS.sharePointPerMinute.points,
  duration: M365_RATE_LIMITS.sharePointPerMinute.durationSeconds,
  keyPrefix: 'm365-sharepoint-per-min',
  storeClient: redisClient,
})

const sharePointPerDayLimiter = new RateLimiterRedis({
  points: M365_RATE_LIMITS.sharePointPerDay.points,
  duration: M365_RATE_LIMITS.sharePointPerDay.durationSeconds,
  keyPrefix: 'm365-sharepoint-per-min',
  storeClient: redisClient,
})

const excelLimiter = new RateLimiterRedis({
  points: M365_RATE_LIMITS.excel.points,
  duration: M365_RATE_LIMITS.excel.durationSeconds,
  keyPrefix: 'm365-excel',
  storeClient: redisClient,
})

const unifiedRateLimiter = new RateLimiterUnion(
  graphApiLimiter,
  sharePointPerMinuteLimiter,
  sharePointPerDayLimiter,
  excelLimiter,
)

type UnionRateLimiterRes = Record<
  IRateLimiterRedisOptions['keyPrefix'],
  RateLimiterRes
>

function isUnionRateLimiterRes(err: unknown): err is UnionRateLimiterRes {
  if (!err || typeof err !== 'object' || Object.keys(err).length === 0) {
    return false
  }

  for (const val of Object.values(err)) {
    if (!(val instanceof RateLimiterRes)) {
      return false
    }
  }

  return true
}

/**
 * We expose this instead of exposing the underlying RateLimiterUnion because
 * union has a _very_ non-standard interface that's footgunny: on rate limit,
 * it throws an {[keyPrefix: string]: RateLimiterRes} object instead of
 * RateLimiterRes itself.
 *
 * While it's understandable why rate-limiter-flexiable did this, this edge case
 * makes standard code like `err instanceof RateLimiterRes` unexpectedly not
 * work, which is bad(tm).
 *
 * To mitigate this, we expose a function which returns the RateLimiterRes with
 * the longest delay, which is usually what callers want anyway.
 */
export async function consumeOrThrowLimiterWithLongestDelay(
  $: IGlobalVariable,
  tenantKey: M365TenantKey,
  points: number,
): Promise<void> {
  try {
    await unifiedRateLimiter.consume(tenantKey, points)
  } catch (error) {
    if (!isUnionRateLimiterRes(error)) {
      throw error
    }

    // Note: guaranteed errorKeys at least length 1 due to
    // isUnionRateLimiterRes check.
    const errorKeys = Object.keys(error)

    logger.warn('Reached internal M365 rate limit', {
      event: 'm365-internally-rate-limited',
      flowId: $.flow?.id,
      stepId: $.step?.id,
      executionId: $.execution?.id,
      tenantKey,
      rateLimitedKeyPrefixes: errorKeys.join(', '),
    })

    // Find and throw the RateLimiterRes with the longest delay.
    let bestError = error[errorKeys[0]]
    for (let i = 1; i < errorKeys.length; ++i) {
      const currError = error[errorKeys[i]]
      if (currError.msBeforeNext > bestError.msBeforeNext) {
        bestError = currError
      }
    }

    throw bestError
  }
}
