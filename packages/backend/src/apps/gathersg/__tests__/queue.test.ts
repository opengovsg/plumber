// Avoid cyclic imports when importing gathersgApp
import '@/apps'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Step from '@/models/step'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'

import gathersgApp from '..'

const stepQueryResult = vi.fn()

describe('Queue config', () => {
  beforeEach(() => {
    spyOnStepQuery(
      createStepQueryChain({
        findById: vi.fn(() => ({
          throwIfNotFound: stepQueryResult,
        })),
      }),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('sets group ID to the connection ID', async () => {
    stepQueryResult.mockResolvedValueOnce({
      connectionId: 'mock-connection-id',
    })
    const groupConfig = await gathersgApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-execution-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-connection-id',
    })
    expect(Step.query).toHaveBeenCalled()
  })

  it('rate limits each connection and spreads calls evenly', () => {
    expect(gathersgApp.queue.groupLimits).toMatchObject({
      type: 'rate-limit',
      limit: {
        max: 1,
        // Duration intentionally left blank here to enable config.
      },
    })
  })

  it('runs on an action worker and does not delay the whole queue', () => {
    expect(gathersgApp.queue.workerType).toEqual('action')
    expect(gathersgApp.queue.isQueueDelayable).toEqual(false)
  })
})
