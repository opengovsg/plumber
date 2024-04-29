import { IGlobalVariable } from '@plumber/types'

import { RateLimiterRes } from 'rate-limiter-flexible'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type M365TenantKey } from '@/config/app-env-vars/m365'

import { GraphApiType } from '../../common/graph-api-type'
import { checkGraphApiRateLimit } from '../../common/rate-limiter'

const TEST_TENANT_KEY = 'test-tenant' as M365TenantKey

const mocks = vi.hoisted(() => ({
  createRedisClient: vi.fn(),
  getGraphApiType: vi.fn(() => GraphApiType.Excel),
  RateLimiterRes: class {
    public msBeforeNext: number

    constructor(msBeforeNext: number) {
      this.msBeforeNext = msBeforeNext
    }
  },
  rateLimiterUnionConsume: vi.fn(),
  logWarning: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: mocks.logWarning,
  },
}))

vi.mock('@/config/redis', () => ({
  REDIS_DB_INDEX: {},
  createRedisClient: mocks.createRedisClient,
}))

vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const origModule = await importOriginal<
    typeof import('rate-limiter-flexible')
  >()

  return {
    ...origModule,

    // Mocking constructors; cannot use arrow functions
    RateLimiterRedis: function ({
      keyPrefix,
    }: ConstructorParameters<typeof origModule.RateLimiterRedis>[0]) {
      return { keyPrefix }
    },
    RateLimiterUnion: function (
      ...limiters: ConstructorParameters<typeof origModule.RateLimiterUnion>
    ) {
      const limiterKeyPrefixes = limiters.map((l) => l.keyPrefix)
      return {
        consume: async (...args: any) => {
          await mocks.rateLimiterUnionConsume(
            // Need to tell our spy which rate limiter union was consumed, so
            // inject key prefixes as the 1st param.
            limiterKeyPrefixes,
            ...args,
          )
        },
      }
    },
  }
})

vi.mock('../../common/graph-api-type', async (importOriginal) => {
  // Don't mock the underlying GraphApiType enum.
  const actualGraphApiType = await importOriginal<
    typeof import('../../common/graph-api-type')
  >()

  return {
    ...actualGraphApiType,
    getGraphApiType: mocks.getGraphApiType,
  }
})

describe('M365 rate limiters', () => {
  const $ = {
    flow: {
      id: 'test-flow-id',
    },
    step: {
      id: 'test-step-id',
    },
    executionId: {
      id: 'test-exec-id',
    },
  } as unknown as IGlobalVariable

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      graphApiType: GraphApiType.Excel,
      expectedConsumedLimits: [
        'm365-graph',
        'm365-sharepoint-per-min',
        'm365-sharepoint-per-day',
        'm365-excel',
      ],
    },
    {
      graphApiType: GraphApiType.SharePoint,
      expectedConsumedLimits: [
        'm365-graph',
        'm365-sharepoint-per-min',
        'm365-sharepoint-per-day',
      ],
    },
    {
      graphApiType: GraphApiType.Unknown,
      expectedConsumedLimits: ['m365-graph'],
    },
  ])(
    'consumes the correct rate limiter depending on Graph API type',
    async ({ graphApiType, expectedConsumedLimits }) => {
      mocks.getGraphApiType.mockReturnValueOnce(graphApiType)
      await checkGraphApiRateLimit($, TEST_TENANT_KEY, '/test-url')
      expect(mocks.rateLimiterUnionConsume).toBeCalledWith(
        expect.arrayContaining(expectedConsumedLimits),
        TEST_TENANT_KEY,
        1,
      )
    },
  )

  it('logs a warning if rate limit is reached', async () => {
    mocks.rateLimiterUnionConsume.mockRejectedValueOnce({
      'test-limiter': new RateLimiterRes(0, 100),
    })
    await expect(
      checkGraphApiRateLimit($, TEST_TENANT_KEY, '/test-url'),
    ).rejects.toThrow(RateLimiterRes)
    expect(mocks.logWarning).toBeCalledWith(
      'Reached internal M365 rate limit',
      expect.objectContaining({ event: 'm365-internally-rate-limited' }),
    )
  })

  it('it throws the RateLimiterRes with the longest delay', async () => {
    mocks.rateLimiterUnionConsume.mockRejectedValueOnce({
      'low-delay-limiter': new RateLimiterRes(0, 100),
      'medium-delay-limiter': new RateLimiterRes(0, 500),
      'big-delay-limiter': new RateLimiterRes(0, 1000),
    })
    await checkGraphApiRateLimit($, TEST_TENANT_KEY, '/test-url')
      .then(() => expect.unreachable())
      .catch((err) => {
        if (!(err instanceof RateLimiterRes)) {
          expect.unreachable()
        }
        expect(err.msBeforeNext).toEqual(1000)
      })
  })
})
