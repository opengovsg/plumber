import type { NextFunction, Request, Response } from 'express'
import * as rateLimiterFlexible from 'rate-limiter-flexible'
import { RateLimiterRes } from 'rate-limiter-flexible'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as redisConfig from '@/config/redis'
import { spyOnLogger } from '@/test/spy-on-logger'

const rateLimiterRedis = {
  consume: vi.fn(),
}

let rateLimitApi: typeof import('../../middleware/rate-limit').rateLimitApi
let logWarn: ReturnType<typeof vi.fn>
let logError: ReturnType<typeof vi.fn>

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeAll(async () => {
    vi.spyOn(redisConfig, 'createRedisClient').mockReturnValue({} as never)
    vi.spyOn(rateLimiterFlexible, 'RateLimiterRedis').mockImplementation(
      function RateLimiterRedisMock() {
        return rateLimiterRedis as never
      },
    )

    vi.resetModules()
    rateLimitApi = (await import('../../middleware/rate-limit')).rateLimitApi
  })

  beforeEach(() => {
    const loggerSpies = spyOnLogger({
      warn: vi.fn(),
      error: vi.fn(),
    })
    logWarn = loggerSpies.warn
    logError = loggerSpies.error

    mockReq = {
      headers: {},
      socket: {
        remoteAddress: '127.0.0.1',
      } as any,
      context: {
        currentUser: {
          id: 'test-user-id',
          email: 'test@plumber.gov.sg',
        } as any,
        isAdminOperation: false,
      } as any,
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response>

    mockNext = vi.fn()

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('rateLimitApi', () => {
    it('should allow request when under rate limit', async () => {
      rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(rateLimiterRedis.consume).toHaveBeenCalledWith('test-user-id')
      expect(mockNext).toHaveBeenCalledOnce()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should use user ID for rate limiting when user is authenticated', async () => {
      rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(rateLimiterRedis.consume).toHaveBeenCalledWith('test-user-id')
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should use IP address when user is not authenticated', async () => {
      mockReq.context = {
        currentUser: null,
        isAdminOperation: false,
      } as any
      mockReq.socket = {
        remoteAddress: '192.168.1.1',
      } as any

      rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(rateLimiterRedis.consume).toHaveBeenCalledWith('192.168.1.1')
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should key off cf-connecting-ip when the request is proxied through Cloudflare', async () => {
      mockReq.context = {
        currentUser: null,
        isAdminOperation: false,
      } as any
      // 173.245.48.1 is the Cloudflare edge appended by the ALB (orange cloud),
      // so cf-connecting-ip is authoritative; the X-Forwarded-For junk is ignored.
      mockReq.headers = {
        'cf-connecting-ip': '203.0.113.42',
        'x-forwarded-for': '198.51.100.99, 173.245.48.1',
      }

      rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(rateLimiterRedis.consume).toHaveBeenCalledWith('203.0.113.42')
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should return 429 when rate limit is exceeded', async () => {
      const rateLimitError = Object.assign(new RateLimiterRes(), {
        msBeforeNext: 5000,
      })

      rateLimiterRedis.consume.mockRejectedValueOnce(rateLimitError)

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should log rate limit violations', async () => {
      const rateLimitError = Object.assign(new RateLimiterRes(), {
        msBeforeNext: 3000,
      })

      rateLimiterRedis.consume.mockRejectedValueOnce(rateLimitError)

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(logWarn).toHaveBeenCalledWith(
        'API endpoint rate limited',
        expect.objectContaining({
          event: 'api-rate-limited',
          userId: 'test-user-id',
          remainingMs: 3000,
        }),
      )
    })

    it('should handle errors gracefully and continue', async () => {
      const genericError = new Error('Redis connection failed')
      rateLimiterRedis.consume.mockRejectedValueOnce(genericError)

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(logError).toHaveBeenCalledWith(
        'Error in rate limiting middleware',
        { error: genericError },
      )
      expect(mockNext).toHaveBeenCalledOnce()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should use IP fallback when no user is available', async () => {
      mockReq.context = {
        currentUser: null,
        isAdminOperation: false,
      } as any
      mockReq.socket = {
        remoteAddress: '10.0.0.1',
      } as any
      mockReq.headers = {}

      rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(rateLimiterRedis.consume).toHaveBeenCalledWith('10.0.0.1')
      expect(mockNext).toHaveBeenCalledOnce()
    })
  })
})
