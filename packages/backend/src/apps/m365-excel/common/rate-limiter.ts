import type { IGlobalVariable } from '@plumber/types'

import {
  type IRateLimiterRedisOptions,
  RateLimiterRedis,
  RateLimiterRes,
  RateLimiterUnion,
} from 'rate-limiter-flexible'

import { M365TenantKey } from '@/config/app-env-vars/m365'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import RetriableError from '@/errors/retriable-error'
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

// FIXME (ogp-weeloong): it turns out MS Graph cannot tolerate 10 QPS spikes
// and will reply with HTTP 429 if we do that (even though it's technically
// within rate limits). This is a workaround to stop these spikes until we get
// BullMQ pro in, by choking ourselves to at most 1 step per 3 seconds per
// file (hypothesis is that Excel can't handle bursts to the same file)
//
// 3 seconds was chosen as that was the P90 of excel API calls over past 2
// weeks.
//
// Note that we don't throttle test runs to enable users to test pipes with more
// than 1 excel step. For published pipes, it's not an issue because of
// auto-retry.
const P90_EXCEL_API_RTT_SECONDS = 3
const perFileStepLimiter = new RateLimiterRedis({
  points: 1,
  duration: P90_EXCEL_API_RTT_SECONDS,
  keyPrefix: 'm365-per-file-step-limiter',
  storeClient: redisClient,
})
export async function throttleStepsForPublishedPipes(
  $: IGlobalVariable,
  fileId: string,
): Promise<void> {
  if ($.execution?.testRun) {
    return
  }

  try {
    await perFileStepLimiter.consume(fileId, 1)
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) {
      throw error
    }

    // Refactoring M365 in later PR. Keeping retry as status quo in this PR.
    throw new RetriableError({
      error: 'Reached M365 step limit',
      // If we're rate limited, we're probably facing a spike of steps for that
      // file, so spread out retries over a wider time period (2x) to reduce the
      // size of the retry thundering herd at any point in time.
      delayInMs: P90_EXCEL_API_RTT_SECONDS * 1000 * 2,
      delayType: 'step',
    })
  }
}

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
