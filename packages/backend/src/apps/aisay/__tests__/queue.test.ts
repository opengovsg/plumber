import '@/apps'

import { afterEach, describe, expect, it, vi } from 'vitest'

import aisayApp from '..'

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

describe('AISAY Queue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets group ID to the connection ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      connectionId: 'mock-connection-id',
      key: 'useGeneralisedModel',
      appKey: 'aisay',
    })
    const groupConfig = await aisayApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-connection-id',
    })
  })

  it('sets group concurrency to 1', () => {
    expect(aisayApp.queue.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })
})
