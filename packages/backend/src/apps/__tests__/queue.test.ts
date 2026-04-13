import '@/apps'

import { afterEach, describe, expect, it, vi } from 'vitest'

import aibotsApp from '../aibots'

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

describe('AIBots Queue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets group ID to the connection ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      connectionId: 'mock-connection-id',
      key: 'sendQuery',
      appKey: 'aibots',
    })
    const groupConfig = await aibotsApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-connection-id',
    })
  })

  it('sets group concurrency to 1', () => {
    expect(aibotsApp.queue.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })

  it('avoids bursting via a leaky bucket approach', () => {
    expect(aibotsApp.queue.queueRateLimit.max).toEqual(2)
  })
})
