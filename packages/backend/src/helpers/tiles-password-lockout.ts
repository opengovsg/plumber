import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import logger from '@/helpers/logger'

/**
 * Exported so that tests can exhaust the allowance without restating the
 * number, which would turn any retune into a test failure.
 */
export const MAX_FAILED_ATTEMPTS = 20

const ATTEMPT_WINDOW_IN_SEC = 10 * 60

/**
 * Keyed per (table, IP) rather than per table, so that one attacker cannot lock
 * every legitimate viewer out of a shared tile.
 */
const tilePasswordLimiter = new RateLimiterRedis({
  points: MAX_FAILED_ATTEMPTS,
  duration: ATTEMPT_WINDOW_IN_SEC,
  keyPrefix: 'tiles-pw',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
})

function makeLockoutKey(tableId: string, clientIp: string): string {
  return `${tableId}:${clientIp}`
}

/**
 * Charges an attempt against the caller's allowance, throwing once it is spent.
 *
 * IMPORTANT: call this before comparing the password, so that concurrent
 * guesses cannot all clear a check-then-increment test.
 */
export async function consumeTilePasswordAttempt(
  tableId: string,
  clientIp: string,
): Promise<void> {
  try {
    await tilePasswordLimiter.consume(makeLockoutKey(tableId, clientIp))
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) {
      // A Redis outage must not make password-protected tiles unopenable.
      logger.error('Error in tile view password lockout', { error })
      return
    }

    logger.warn('Tile view password locked out', {
      event: 'tiles-password-lockout',
      tableId,
      userIp: clientIp,
      remainingMs: error.msBeforeNext,
    })
    throw new RateLimitedError(
      'Too many failed password attempts. Please try again later.',
    )
  }
}

export async function clearTilePasswordAttempts(
  tableId: string,
  clientIp: string,
): Promise<void> {
  try {
    await tilePasswordLimiter.delete(makeLockoutKey(tableId, clientIp))
  } catch (error) {
    // The password was already correct, so refusing the viewer now is worse.
    logger.error('Error clearing tile view password attempts', { error })
  }
}
