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
    actionQueue: {
      add: vi.fn(),
    },
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
      findById: vi.fn(() => mocks.flow),
    })),
  },
}))
vi.mock('@/services/trigger', () => ({
  processTrigger: mocks.processTrigger,
}))
vi.mock('@/queues/action', () => ({
  default: mocks.actionQueue,
}))
vi.mock('rate-limiter-flexible', async () => ({
  RateLimiterRes: mocks.rateLimiterRes,
  // Mocking constructor; cannot use arrow functions
  RateLimiterRedis: function () {
    return mocks.rateLimiterRedis
  },
}))

describe('webhook handler', () => {
  let request: IRequest

  beforeEach(() => {
    request = {
      params: {
        flowId: 'fad50966-f810-43d0-a2c2-20759c611a82',
      },
      body: 'abc',
      rawBody: Buffer.from('abc'),
    } as unknown as IRequest
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rate limits', () => {
    it.each([{ isActiveFlow: true }, { isActiveFlow: false }])(
      'allows pipes to execute if they are not rate limited',
      async ({ isActiveFlow }) => {
        mocks.flow.active = isActiveFlow
        await webhookHandler(request, mocks.response)
        expect(mocks.processTrigger).toHaveBeenCalledOnce()
        if (isActiveFlow) {
          expect(mocks.actionQueue.add).toHaveBeenCalledOnce()
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
        expect(mocks.actionQueue.add).not.toHaveBeenCalled()
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
          expect(mocks.actionQueue.add).toHaveBeenCalledOnce()
        }
        expect(mocks.response.sendStatus).toHaveReturnedWith(200)
      },
    )
  })
})
