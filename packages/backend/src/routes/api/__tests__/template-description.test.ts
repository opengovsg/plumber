import type { Request, Response } from 'express'
import { RateLimiterRes } from 'rate-limiter-flexible'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  findOne: vi.fn(),
  withGraphFetched: vi.fn(),
  withAccessibleFlows: vi.fn(),
  generate: vi.fn(),
  apiKey: 'test-key',
}))
vi.mock('@/config/app', () => ({
  default: {
    templateDescription: {
      get apiKey() {
        return mocks.apiKey
      },
    },
  },
}))
vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))
vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('rate-limiter-flexible')
  >()
  return {
    ...original,
    RateLimiterRedis: vi.fn(() => ({ consume: mocks.consume })),
  }
})
vi.mock('@/helpers/generate-template-description', () => ({
  generateTemplateDescription: mocks.generate,
}))
vi.mock('@/helpers/logger', () => ({ default: { error: vi.fn() } }))

import router from '../template-description'

const flowId = '11111111-1111-4111-8111-111111111111'
async function request(body: unknown) {
  const req = {
    body,
    context: {
      currentUser: {
        id: 'user-id',
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

describe('template description endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiKey = 'test-key'
    mocks.consume.mockResolvedValue(undefined)
    mocks.withAccessibleFlows.mockReturnValue({
      withGraphFetched: mocks.withGraphFetched,
    })
    mocks.withGraphFetched.mockReturnValue({ findOne: mocks.findOne })
    mocks.findOne.mockResolvedValue({ steps: [{ position: 1 }] })
    mocks.generate.mockResolvedValue('Generated description')
  })

  it('generates only after checking viewer access to the requested flow', async () => {
    const res = await request({ flowId })
    expect(mocks.withAccessibleFlows).toHaveBeenCalledWith({
      requiredRole: 'viewer',
    })
    expect(mocks.findOne).toHaveBeenCalledWith({ 'flows.id': flowId })
    expect(mocks.consume).toHaveBeenCalledWith('user-id')
    expect(res.json).toHaveBeenCalledWith({
      description: 'Generated description',
    })
  })

  it('does not generate for an inaccessible flow', async () => {
    mocks.findOne.mockResolvedValue(undefined)
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('rejects invalid IDs before loading steps', async () => {
    const res = await request({ flowId: 'bad-id' })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mocks.findOne).not.toHaveBeenCalled()
  })

  it('returns unavailable when the gateway is not configured', async () => {
    mocks.apiKey = ''
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(503)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('limits paid generation requests per user', async () => {
    mocks.consume.mockRejectedValue(
      new RateLimiterRes(0, 60000, 6, false),
    )
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(429)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('does not generate when the rate limiter is unavailable', async () => {
    mocks.consume.mockRejectedValue(new Error('Redis unavailable'))
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(503)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('does not expose provider errors to the user', async () => {
    mocks.generate.mockRejectedValue(new Error('Authorization: secret'))
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Description generation is unavailable',
    })
  })

  it.each([
    { steps: [] },
    { steps: Array.from({ length: 101 }, () => ({ position: 1 })) },
  ])('rejects unsupported step counts', async ({ steps }) => {
    mocks.findOne.mockResolvedValue({ steps })
    const res = await request({ flowId })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
