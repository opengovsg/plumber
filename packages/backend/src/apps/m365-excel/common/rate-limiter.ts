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

import { getGraphApiType, GraphApiType } from './graph-api-type'

const redisClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

// Limits are based on agreement with Govtech team. For simplicity, we'll apply
// the same rate limits to all other tenants.
const M365_BASE_RATE_LIMITS = Object.freeze({
  graphApi: new RateLimiterRedis({
    points: 13000,
    duration: 10,
    keyPrefix: 'm365-graph',
    storeClient: redisClient,
  }),
  sharePointPerMinute: new RateLimiterRedis({
    points: 300,
    duration: 60,
    keyPrefix: 'm365-sharepoint-per-min',
    storeClient: redisClient,
  }),
  sharePointPerDay: new RateLimiterRedis({
    points: 300000,
    duration: 60 * 60 * 24,
    keyPrefix: 'm365-sharepoint-per-day',
    storeClient: redisClient,
  }),
  excel: new RateLimiterRedis({
    points: 150,
    duration: 10,
    keyPrefix: 'm365-excel',
    storeClient: redisClient,
  }),
})

// SharePoint API calls go through Graph API and SharePoint services.
const sharePointApiRateLimiter = new RateLimiterUnion(
  M365_BASE_RATE_LIMITS.graphApi,
  M365_BASE_RATE_LIMITS.sharePointPerDay,
  M365_BASE_RATE_LIMITS.sharePointPerMinute,
)

// Excel API calls go through Graph API, SharePoint and Excel services.
const excelApiRateLimiter = new RateLimiterUnion(
  M365_BASE_RATE_LIMITS.graphApi,
  M365_BASE_RATE_LIMITS.sharePointPerDay,
  M365_BASE_RATE_LIMITS.sharePointPerMinute,
  M365_BASE_RATE_LIMITS.excel,
)

// All other Graph API calls made by this Excel app only go through the Graph
// API service.
const graphApiRateLimiter = new RateLimiterUnion(M365_BASE_RATE_LIMITS.graphApi)

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
export async function checkGraphApiRateLimit(
  $: IGlobalVariable,
  tenantKey: M365TenantKey,
  url: string,
): Promise<void> {
  try {
    let rateLimiter: RateLimiterUnion | null = null

    switch (getGraphApiType(url)) {
      case GraphApiType.Excel:
        rateLimiter = excelApiRateLimiter
        break
      case GraphApiType.SharePoint:
        rateLimiter = sharePointApiRateLimiter
        break
      case GraphApiType.Unknown:
        rateLimiter = graphApiRateLimiter
        break
    }

    await rateLimiter.consume(tenantKey, 1)
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
