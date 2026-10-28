import { APICallError } from 'ai'
import type { Request, Response } from 'express'
import { RateLimiterRes } from 'rate-limiter-flexible'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  findOne: vi.fn(),
  withGraphFetched: vi.fn(),
  withAccessibleFlows: vi.fn(),
  generate: vi.fn(),
  logError: vi.fn(),
  isPlumPro: vi.fn(),
}))
vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))
vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('rate-limiter-flexible')>()
  return {
    ...original,
    // Vitest 4 only constructs mocks built from a function or class.
    RateLimiterRedis: vi.fn(function () {
      return { consume: mocks.consume }
    }),
  }
})
vi.mock('@/helpers/generate-template-description', () => ({
  generateTemplateDescription: mocks.generate,
}))
vi.mock('@/helpers/logger', () => ({ default: { error: mocks.logError } }))
vi.mock('@/helpers/plumpro', () => ({ isPlumPro: mocks.isPlumPro }))
// The real middleware loads every app, which this unit test does not need.
vi.mock('../middleware/authentication', () => ({
  getAuthenticatedContext: (req: { context: unknown }) => req.context,
}))

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
  const handler = router.stack.find((layer) => layer.route?.path === '/')!
    .route!.stack[0]!.handle
  await handler(req, res as unknown as Response, vi.fn())
  return res
}

describe('template description endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPlumPro.mockResolvedValue(true)
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

  it('limits paid generation requests per user', async () => {
    mocks.consume.mockRejectedValue(new RateLimiterRes(0, 60000, 6, false))
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
  describe('failure logging', () => {
    const SECRET = 'Authorization: Bearer secret prompt text'

    function loggedFailure() {
      expect(mocks.logError).toHaveBeenCalledTimes(1)
      const [, details] = mocks.logError.mock.calls[0]
      expect(JSON.stringify(details)).not.toContain('secret')
      return details
    }

    it('logs a provider error with its status code only', async () => {
      mocks.generate.mockRejectedValue(
        new APICallError({
          message: SECRET,
          url: 'https://bedrock.example',
          requestBodyValues: { prompt: SECRET },
          statusCode: 529,
        }),
      )
      const res = await request({ flowId })
      expect(res.status).toHaveBeenCalledWith(503)
      expect(loggedFailure()).toMatchObject({
        category: 'provider-error',
        statusCode: 529,
        flowId,
        userId: 'user-id',
      })
    })

    it('logs a timeout', async () => {
      mocks.generate.mockRejectedValue(
        new DOMException('The operation timed out.', 'TimeoutError'),
      )
      await request({ flowId })
      expect(loggedFailure()).toMatchObject({
        category: 'timeout',
        errorName: 'TimeoutError',
      })
    })

    it('logs invalid model output', async () => {
      mocks.generate.mockRejectedValue(z.string().min(1).safeParse('').error)
      await request({ flowId })
      expect(loggedFailure()).toMatchObject({ category: 'invalid-output' })
    })

    it('logs a failed PlumPro check', async () => {
      mocks.isPlumPro.mockRejectedValue(new Error(SECRET))
      const res = await request({ flowId })
      expect(res.status).toHaveBeenCalledWith(503)
      expect(loggedFailure()).toMatchObject({ category: 'access-check-failed' })
      expect(mocks.consume).not.toHaveBeenCalled()
    })

    it('logs an unavailable rate limiter', async () => {
      mocks.consume.mockRejectedValue(new Error(SECRET))
      await request({ flowId })
      expect(loggedFailure()).toMatchObject({
        category: 'rate-limiter-unavailable',
        errorName: 'Error',
      })
    })

    it('logs a failed pipe lookup', async () => {
      mocks.findOne.mockRejectedValue(new Error(SECRET))
      const res = await request({ flowId })
      expect(res.status).toHaveBeenCalledWith(503)
      expect(loggedFailure()).toMatchObject({ category: 'pipe-lookup-failed' })
    })
  })
})
