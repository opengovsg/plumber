// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Step from '@/models/step'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'

import tilesApp from '..'

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

  it('sets group ID to the file ID', async () => {
    stepQueryResult.mockResolvedValueOnce({
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
    expect(Step.query).toHaveBeenCalled()
  })

  it('sets group ID to null', async () => {
    stepQueryResult.mockResolvedValueOnce({
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
