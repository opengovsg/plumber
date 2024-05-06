import { IRequest } from '@plumber/types'

import { Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import webhookHandler from '../../webhooks/handler'

const mocks = vi.hoisted(() => {
  return {
    rateLimiterRes: class {},
    rateLimiterRedis: {
      consume: vi.fn(),
    },
    response: {
      sendStatus: vi.fn((code) => code),
    } as unknown as Response,
    flow: {
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
    },
    processTrigger: vi.fn(() => ({ executionId: 'execution-id' })),
    enqueueActionJob: vi.fn(),
  }
})

vi.mock('@/helpers/tracer', () => ({
  default: {
    scope: vi.fn(() => ({
      active: vi.fn(),
    })),
  },
}))
vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))
vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({ withGraphJoined: () => mocks.flow })),
    })),
  },
}))
vi.mock('@/services/trigger', () => ({
  processTrigger: mocks.processTrigger,
}))
vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))
vi.mock('rate-limiter-flexible', async () => ({
  RateLimiterRes: mocks.rateLimiterRes,
  // Mocking constructor; cannot use arrow functions
  RateLimiterRedis: function () {
    return mocks.rateLimiterRedis
  },
}))

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

  beforeEach(() => {
    request = {
      params: {
        flowId: FLOW_ID,
      },
      body: BODY,
      rawBody: Buffer.from('abc'),
    } as unknown as IRequest
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('webhook body and query param variables', () => {
    it('should support body variables', async () => {
      await webhookHandler(request, mocks.response)
      expect(mocks.processTrigger).toBeCalledWith(
        // PSA from weeloong, expect.objectContaining does not work for nested objects
        expect.objectContaining({
          triggerItem: expect.objectContaining({ raw: BODY }),
        }),
      )
    })
    it('should support query param variables', async () => {
      request.query = QUERY_PARAMS
      delete request.body

      await webhookHandler(request, mocks.response)
      expect(mocks.processTrigger).toBeCalledWith(
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
      await webhookHandler(request, mocks.response)
      expect(mocks.processTrigger).toBeCalledWith(
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
      await webhookHandler(request, mocks.response)
      expect(mocks.processTrigger).toBeCalledWith(
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
        mocks.flow.active = isActiveFlow
        await webhookHandler(request, mocks.response)
        expect(mocks.processTrigger).toHaveBeenCalledOnce()
        if (isActiveFlow) {
          expect(mocks.enqueueActionJob).toHaveBeenCalledOnce()
        }
        expect(mocks.response.sendStatus).toHaveReturnedWith(200)
      },
    )

    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'does not execute pipes if they are rate limited',
      async ({ isActiveFlow }) => {
        mocks.flow.active = isActiveFlow
        mocks.rateLimiterRedis.consume.mockImplementation(() => {
          throw new mocks.rateLimiterRes()
        })
        await webhookHandler(request, mocks.response)
        expect(mocks.processTrigger).not.toHaveBeenCalled()
        expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
        expect(mocks.response.sendStatus).toHaveReturnedWith(429)
      },
    )

    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'still executes rate-limited pipes if rejectIfOverMaxQps is false',
      async ({ isActiveFlow }) => {
        mocks.flow.active = isActiveFlow
        mocks.flow.config = { rejectIfOverMaxQps: false }
        mocks.rateLimiterRedis.consume.mockImplementation(() => {
          throw new mocks.rateLimiterRes()
        })
        await webhookHandler(request, mocks.response)
        expect(mocks.processTrigger).toHaveBeenCalledOnce()
        if (isActiveFlow) {
          expect(mocks.enqueueActionJob).toHaveBeenCalledOnce()
        }
        expect(mocks.response.sendStatus).toHaveReturnedWith(200)
      },
    )
  })
})
