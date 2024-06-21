import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import { M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS } from '@/config/app-env-vars/m365'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'

const redisClient = createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)

// Rough numbers for release only.
// Instead of rate limiting per second, we allow spikes in 30 second windows to
// make the UX not _as_ bad.
//
// (e.g. thundering herd spams tests within the 1st 10 seconds and use up all
// quota allocated for 30s, but they don't complain since they're busy
// publishing or thinking about why they had an error)
const ACTIONS_PER_SECOND = 1000 / M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS
const DURATION_SECONDS = 30
const ACTIONS_PER_DURATION = Math.floor(ACTIONS_PER_SECOND * DURATION_SECONDS)

const rateLimiter = new RateLimiterRedis({
  points: ACTIONS_PER_DURATION,
  duration: DURATION_SECONDS,
  keyPrefix: 'm365-release-limiter',
  storeClient: redisClient,
})

export async function RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024() {
  try {
    await rateLimiter.consume(1)
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) {
      throw error
    }

    throw new Error(
      'Excel has reached its limit. There are too many users on Excel at this moment. Try testing your step again later.',
    )
  }
}
