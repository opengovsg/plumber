import type { IGlobalVariable } from '@plumber/types'

import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import StepError from '@/errors/step'
import { getLdFlagValue } from '@/helpers/launch-darkly'

const redisClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

// Rate limiter to control potential thundering herd during release period
// --
// This applies a rate limit on users doing test steps in our UI. This is needed
// because we don't queue frontend actions, but there's a risk many users will
// explore this feature at release time and overload M365 backend.
//
// We're currently allocated ~4 excel actions per second, and we'll allocate ~3
// actions per second to our frontend.
//
// Note that instead of rate limiting per second, we allow spikes in ~10 second
// windows to make the UX not _as_ bad (e.g. thundering herd spams tests within
// the 1st 5 seconds and use up all quota allocated for 10s, but they don't
// complain since they're busy publishing or thinking about why they had an
// error).

const DURATION_SECONDS = 10
const ACTIONS_PER_DURATION = 30 // 3 actions per second, for 10 seconds.

const rateLimiter = new RateLimiterRedis({
  points: ACTIONS_PER_DURATION,
  duration: DURATION_SECONDS,
  keyPrefix: 'm365-release-limiter',
  storeClient: redisClient,
})

function throwError($?: IGlobalVariable): never {
  if ($) {
    throw new StepError(
      'Excel has reached its limit',
      'There are too many users testing Excel at this moment. Try testing your step again later.',
      $.step.position,
      $.app.name,
    )
  } else {
    throw new Error(
      'There are too many users testing Excel at this moment. Try again later.',
    )
  }
}

const LD_FLAG_RATE_LIMIT_TYPE = 'm365-excel-release-rate-limit-type'
const RATE_LIMIT_TYPE_RATE_LIMITED = 'rate-limited'
const RATE_LIMIT_TYPE_NOT_RATE_LIMITED = 'not-rate-limited'
const RATE_LIMIT_TYPE_BANNED = 'banned'

export async function RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024(
  userEmail: string,
  $?: IGlobalVariable,
) {
  const rateLimitType = await getLdFlagValue<string>(
    LD_FLAG_RATE_LIMIT_TYPE,
    userEmail,
    RATE_LIMIT_TYPE_RATE_LIMITED,
  )

  if (rateLimitType === RATE_LIMIT_TYPE_NOT_RATE_LIMITED) {
    return
  }

  if (rateLimitType === RATE_LIMIT_TYPE_BANNED) {
    return throwError($)
  }

  try {
    await rateLimiter.consume('global-rate-limit', 1)
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) {
      throw error
    }
    throwError($)
  }
}
