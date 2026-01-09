import type { NextFunction, Request, Response } from 'express'
import { RateLimiterRes } from 'rate-limiter-flexible'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rateLimitApi } from '../../middleware/rate-limit'

const mocks = vi.hoisted(() => ({
  rateLimiterRedis: {
    consume: vi.fn(),
  },
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  createRedisClient: vi.fn(),
}))

vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rate-limiter-flexible')>()
  return {
    ...actual,
    RateLimiterRedis: vi.fn(function () {
      return mocks.rateLimiterRedis
    }),
  }
})

vi.mock('@/helpers/logger', () => ({
  default: mocks.logger,
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: mocks.createRedisClient,
  REDIS_DB_INDEX: {
    RATE_LIMIT: 'rate-limit',
  },
}))

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
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
    vi.restoreAllMocks()
  })

  describe('rateLimitApi', () => {
    it('should allow request when under rate limit', async () => {
      mocks.rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.rateLimiterRedis.consume).toHaveBeenCalledWith(
        'test-user-id',
      )
      expect(mockNext).toHaveBeenCalledOnce()
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should use user ID for rate limiting when user is authenticated', async () => {
      mocks.rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.rateLimiterRedis.consume).toHaveBeenCalledWith(
        'test-user-id',
      )
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

      mocks.rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.rateLimiterRedis.consume).toHaveBeenCalledWith('192.168.1.1')
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should use Cloudflare IP when available', async () => {
      mockReq.context = {
        currentUser: null,
        isAdminOperation: false,
      } as any
      mockReq.headers = {
        'cf-connecting-ip': '203.0.113.42',
      }

      mocks.rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.rateLimiterRedis.consume).toHaveBeenCalledWith(
        '203.0.113.42',
      )
      expect(mockNext).toHaveBeenCalledOnce()
    })

    it('should return 429 when rate limit is exceeded', async () => {
      const rateLimitError = Object.assign(new RateLimiterRes(), {
        msBeforeNext: 5000,
      })

      mocks.rateLimiterRedis.consume.mockRejectedValueOnce(rateLimitError)

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

      mocks.rateLimiterRedis.consume.mockRejectedValueOnce(rateLimitError)

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.logger.warn).toHaveBeenCalledWith(
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
      mocks.rateLimiterRedis.consume.mockRejectedValueOnce(genericError)

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.logger.error).toHaveBeenCalledWith(
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

      mocks.rateLimiterRedis.consume.mockResolvedValueOnce({})

      await rateLimitApi(mockReq as Request, mockRes as Response, mockNext)

      expect(mocks.rateLimiterRedis.consume).toHaveBeenCalledWith('10.0.0.1')
      expect(mockNext).toHaveBeenCalledOnce()
    })
  })
})
