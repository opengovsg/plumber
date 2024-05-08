// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'

import { afterEach, describe, expect, it, vi } from 'vitest'

import m365ExcelApp from '..'

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

  it('configures a delayable queue', () => {
    expect(m365ExcelApp.queue.isQueueDelayable).toEqual(true)
  })

  it('sets group ID to the file ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      parameters: {
        fileId: 'mock-file-id',
      },
    })
    const groupConfig = await m365ExcelApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-file-id',
    })
  })

  it('sets group concurrency to 1', () => {
    expect(m365ExcelApp.queue.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })

  it('avoids bursting via a leaky bucket approach', () => {
    expect(m365ExcelApp.queue.queueRateLimit.max).toEqual(1)
  })
})
