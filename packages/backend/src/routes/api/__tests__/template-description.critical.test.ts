// Business rule: "Convert to template" should only be available to PlumPros.
import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  generate: vi.fn(),
  getLdFlagValue: vi.fn(),
  withAccessibleFlows: vi.fn(),
}))
vi.mock('@/config/app', () => ({
  default: { templateDescription: { apiKey: 'test-key' } },
}))
vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))
vi.mock('rate-limiter-flexible', async (importOriginal) => ({
  ...(await importOriginal<typeof import('rate-limiter-flexible')>()),
  // Vitest 4 only constructs mocks built from a function or class.
  RateLimiterRedis: vi.fn(function () {
    return { consume: mocks.consume }
  }),
}))
vi.mock('@/helpers/generate-template-description', () => ({
  generateTemplateDescription: mocks.generate,
}))
vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))
vi.mock('@/helpers/logger', () => ({ default: { error: vi.fn() } }))

import router from '../template-description'

async function request() {
  const req = {
    body: { flowId: '11111111-1111-4111-8111-111111111111' },
    context: {
      currentUser: {
        id: 'user-id',
        email: 'user@open.gov.sg',
        withAccessibleFlows: mocks.withAccessibleFlows,
      },
    },
  } as unknown as Request
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  const handler = router.stack.find((layer) => layer.route?.path === '/')?.route
    .stack[0].handle
  await handler(req, res as unknown as Response, vi.fn())
  return res
}

describe('template description PlumPro access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects users who are not PlumPros before any other work', async () => {
    mocks.getLdFlagValue.mockResolvedValue(false)

    const res = await request()

    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      'plumpro',
      'user@open.gov.sg',
      false,
    )
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.consume).not.toHaveBeenCalled()
    expect(mocks.withAccessibleFlows).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('lets PlumPros continue to the rate limit and pipe lookup', async () => {
    mocks.getLdFlagValue.mockResolvedValue(true)
    mocks.withAccessibleFlows.mockReturnValue({
      withGraphFetched: () => ({
        findOne: async (): Promise<undefined> => undefined,
      }),
    })

    const res = await request()

    expect(mocks.consume).toHaveBeenCalledWith('user-id')
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
