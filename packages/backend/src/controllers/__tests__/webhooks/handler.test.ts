import { IRequest } from '@plumber/types'
import { Response } from 'express'
import * as rateLimiterFlexible from 'rate-limiter-flexible'
import { RateLimiterRes } from 'rate-limiter-flexible'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as redisConfig from '@/config/redis'
import tracer from '@/helpers/tracer'
import Flow from '@/models/flow'
import * as actionQueue from '@/queues/action'
import * as triggerService from '@/services/trigger'
import { spyOnLogger } from '@/test/spy-on-logger'

const rateLimiterRedis = {
  consume: vi.fn(),
}

const response = {
  sendStatus: vi.fn((code) => code),
} as unknown as Response

const flow = {
  active: false,
  config: {},
  getTriggerStep: vi.fn(() => ({
    getNextStep: vi.fn(() => ({
      id: 'next-step-id',
    })),
    getTriggerCommand: vi.fn(() => ({
      type: 'webhook',
    })),
    getApp: vi.fn(() => ({
      key: 'webhook',
    })),
  })),
}

const processTrigger = vi.fn(() => ({
  executionId: 'execution-id',
  shouldExecute: true,
}))

const enqueueActionJob = vi.fn()

let webhookHandler: typeof import('../../webhooks/handler').default

const FLOW_ID = 'fad50966-f810-43d0-a2c2-20759c611a82'
const QUERY_PARAMS = {
  hello: 'world',
  fish: '123',
  array: ['a', 'b'],
}
const BODY = {
  fish: 'paste',
}

describe('webhook handler', () => {
  let request: IRequest

  beforeAll(async () => {
    vi.spyOn(redisConfig, 'createRedisClient').mockReturnValue({} as never)
    vi.spyOn(rateLimiterFlexible, 'RateLimiterRedis').mockImplementation(
      function RateLimiterRedisMock() {
        return rateLimiterRedis as never
      },
    )
    vi.spyOn(tracer, 'scope').mockReturnValue({
      active: vi.fn(),
    } as never)

    spyOnLogger({ info: vi.fn(), warn: vi.fn() })

    const findById = vi.fn(() => ({ withGraphJoined: () => flow }))
    vi.spyOn(Flow, 'query').mockReturnValue({
      findById,
    } as never)

    vi.spyOn(triggerService, 'processTrigger').mockImplementation(
      processTrigger,
    )
    vi.spyOn(actionQueue, 'enqueueActionJob').mockImplementation(
      enqueueActionJob,
    )

    vi.resetModules()
    webhookHandler = (await import('../../webhooks/handler')).default
  })

  beforeEach(() => {
    request = {
      params: {
        flowId: FLOW_ID,
      },
      body: BODY,
      rawBody: Buffer.from('abc'),
    } as unknown as IRequest

    flow.active = false
    flow.config = {}
    rateLimiterRedis.consume.mockReset()
    processTrigger.mockReset()
    processTrigger.mockReturnValue({
      executionId: 'execution-id',
      shouldExecute: true,
    })
    enqueueActionJob.mockReset()
    response.sendStatus = vi.fn((code) => code) as never
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('webhook body and query param variables', () => {
    it('should support body variables', async () => {
      await webhookHandler(request, response)
      expect(processTrigger).toHaveBeenCalledWith(
        // PSA from weeloong, expect.objectContaining does not work for nested objects
        expect.objectContaining({
          triggerItem: expect.objectContaining({ raw: BODY }),
        }),
      )
    })
    it('should support query param variables', async () => {
      request.query = QUERY_PARAMS
      delete request.body

      await webhookHandler(request, response)
      expect(processTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerItem: expect.objectContaining({
            raw: {
              _query: QUERY_PARAMS,
            },
          }),
        }),
      )
    })

    it('should support both query and body param variables', async () => {
      request.query = QUERY_PARAMS
      await webhookHandler(request, response)
      expect(processTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerItem: expect.objectContaining({
            raw: {
              ...BODY,
              _query: QUERY_PARAMS,
            },
          }),
        }),
      )
    })

    it('should support both query and body param variables with body having precedence', async () => {
      request.query = QUERY_PARAMS
      request.body = {
        _query: {
          hello: 'this will override query params',
        },
      }
      await webhookHandler(request, response)
      expect(processTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerItem: expect.objectContaining({
            raw: {
              _query: request.body._query,
            },
          }),
        }),
      )
    })
  })

  describe('rate limits', () => {
    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'allows pipes to execute if they are not rate limited',
      async ({ isActiveFlow }) => {
        flow.active = isActiveFlow
        await webhookHandler(request, response)
        expect(processTrigger).toHaveBeenCalledOnce()
        if (isActiveFlow) {
          expect(enqueueActionJob).toHaveBeenCalledOnce()
        }
        expect(response.sendStatus).toHaveReturnedWith(200)
      },
    )

    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'does not execute pipes if they are rate limited',
      async ({ isActiveFlow }) => {
        flow.active = isActiveFlow
        rateLimiterRedis.consume.mockImplementation(() => {
          throw new RateLimiterRes()
        })
        await webhookHandler(request, response)
        expect(processTrigger).not.toHaveBeenCalled()
        expect(enqueueActionJob).not.toHaveBeenCalled()
        expect(response.sendStatus).toHaveReturnedWith(429)
      },
    )

    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'still executes rate-limited pipes if rejectIfOverMaxQps is false',
      async ({ isActiveFlow }) => {
        flow.active = isActiveFlow
        flow.config = { rejectIfOverMaxQps: false }
        rateLimiterRedis.consume.mockImplementation(() => {
          throw new RateLimiterRes()
        })
        await webhookHandler(request, response)
        expect(processTrigger).toHaveBeenCalledOnce()
        if (isActiveFlow) {
          expect(enqueueActionJob).toHaveBeenCalledOnce()
        }
        expect(response.sendStatus).toHaveReturnedWith(200)
      },
    )

    it('should not enqueue job when processTrigger returns shouldExecute: false', async () => {
      flow.active = true
      processTrigger.mockResolvedValueOnce({
        executionId: 'execution-id',
        shouldExecute: false,
      })

      await webhookHandler(request, response)

      expect(processTrigger).toHaveBeenCalledOnce()
      expect(enqueueActionJob).not.toHaveBeenCalled()
      expect(response.sendStatus).toHaveReturnedWith(200)
    })
  })

  describe('pipe force clog', () => {
    beforeEach(() => {
      flow.config = {}
    })

    it('returns 423 and does not process the trigger or enqueue a job', async () => {
      flow.config = { isForceClogged: true }

      await webhookHandler(request, response)

      expect(response.sendStatus).toHaveReturnedWith(423)
      expect(processTrigger).not.toHaveBeenCalled()
      expect(enqueueActionJob).not.toHaveBeenCalled()
    })
  })
})
