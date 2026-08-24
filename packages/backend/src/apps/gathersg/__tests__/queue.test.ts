// Avoid cyclic imports when importing gathersgApp
import '@/apps'
import { afterEach, describe, expect, it, vi } from 'vitest'

import gathersgApp from '..'

const mocks = vi.hoisted(() => ({
  stepQueryResult: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: mocks.stepQueryResult,
      })),
    })),
  },
}))

describe('Queue config', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets group ID to the connection ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
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
