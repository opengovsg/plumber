import { RateLimiterRes } from 'rate-limiter-flexible'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories are hoisted above plain const declarations.
const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  deleteKey: vi.fn(),
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: () => ({}),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))

vi.mock('@/helpers/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rate-limiter-flexible')>()
  return {
    ...actual,
    RateLimiterRedis: class {
      consume = mocks.consume
      delete = mocks.deleteKey
    },
  }
})

import BaseError from '@/errors/base'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'

import {
  clearTilePasswordAttempts,
  consumeTilePasswordAttempt,
} from '../tiles-password-lockout'

const TABLE_ID = 'table-1'
const CLIENT_IP = '1.2.3.4'

describe('tiles password lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('consumeTilePasswordAttempt', () => {
    it('resolves while the caller is within the allowance', async () => {
      mocks.consume.mockResolvedValue(new RateLimiterRes(19, 0, 1))

      await expect(
        consumeTilePasswordAttempt(TABLE_ID, CLIENT_IP),
      ).resolves.toBeUndefined()
      expect(mocks.consume).toHaveBeenCalledWith(`${TABLE_ID}:${CLIENT_IP}`)
    })

    it('throws RateLimitedError once the allowance is spent', async () => {
      mocks.consume.mockRejectedValue(new RateLimiterRes(0, 60_000, 21))

      await expect(
        consumeTilePasswordAttempt(TABLE_ID, CLIENT_IP),
      ).rejects.toThrow(RateLimitedError)
    })

    it('fails closed when the counter is unavailable', async () => {
      mocks.consume.mockRejectedValue(
        new Error('Redis connection is not ready'),
      )

      await expect(
        consumeTilePasswordAttempt(TABLE_ID, CLIENT_IP),
      ).rejects.toThrow(BaseError)
    })

    it('does not report a counter outage as a rate limit', async () => {
      mocks.consume.mockRejectedValue(
        new Error('Redis connection is not ready'),
      )

      // RATE_LIMITED tells the viewer to wait it out, which is the wrong advice
      // and the wrong HTTP status for a server fault.
      await expect(
        consumeTilePasswordAttempt(TABLE_ID, CLIENT_IP),
      ).rejects.not.toThrow(RateLimitedError)
    })
  })

  describe('clearTilePasswordAttempts', () => {
    it('swallows a counter outage', async () => {
      mocks.deleteKey.mockRejectedValue(
        new Error('Redis connection is not ready'),
      )

      // The password already matched, so refusing the viewer now gains nothing.
      await expect(
        clearTilePasswordAttempts(TABLE_ID, CLIENT_IP),
      ).resolves.toBeUndefined()
    })
  })
})
