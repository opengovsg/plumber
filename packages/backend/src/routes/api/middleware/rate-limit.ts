import type { NextFunction, Request, Response } from 'express'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { getClientIp } from '@/helpers/get-client-ip'
import logger from '@/helpers/logger'

// Create rate limiter for API routes
// Allow 10 requests per minute per user/IP
// NOTE: this works now because we only have 1 route,
// it may need to be updated if we add more routes
const apiRateLimiter = new RateLimiterRedis({
  points: 10, // number of requests
  duration: 60, // per 60 seconds (1 minute)
  keyPrefix: 'api-rate',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
})

/**
 * Rate limiting middleware for API routes.
 * Limits requests per user/IP to prevent abuse of expensive endpoints.
 *
 * Rate limit: 10 requests per minute per user/IP
 * Uses the same IP identification logic as GraphQL authentication.
 */
export async function rateLimitApi(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Use user ID if available, otherwise fall back to IP address
  const userId = req.context?.currentUser?.id
  const userIp = getClientIp(req)

  const rateLimitKey = userId || userIp

  try {
    await apiRateLimiter.consume(rateLimitKey)
    next()
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      logger.warn('API endpoint rate limited', {
        event: 'api-rate-limited',
        userId,
        userIp,
        remainingMs: error.msBeforeNext,
      })

      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      })
      return
    }

    // If it's not a rate limit error, log it and continue
    logger.error('Error in rate limiting middleware', { error })
    next()
  }
}
