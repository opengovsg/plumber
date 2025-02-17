// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'

import { afterEach, describe, expect, it, vi } from 'vitest'

import tilesApp from '..'

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

  it('sets group ID to the file ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      parameters: {
        tableId: 'mock-table-id',
      },
      key: 'findSingleRow',
      appKey: 'tiles',
    })
    const groupConfig = await tilesApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-table-id-findSingleRow',
    })
  })

  it('sets group ID to null', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      parameters: {
        tableId: 'mock-table-id',
      },
      key: 'createRow',
      appKey: 'tiles',
    })
    const groupConfig = await tilesApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual(null)
  })

  it('sets group concurrency to 1', () => {
    expect(tilesApp.queue.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })
})
