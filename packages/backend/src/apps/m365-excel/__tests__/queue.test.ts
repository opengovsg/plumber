// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Step from '@/models/step'
import { createStepQueryChain, spyOnStepQuery } from '@/test/spy-on-step-query'

import m365ExcelApp from '..'

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

  it('configures a delayable queue', () => {
    expect(m365ExcelApp.queue.isQueueDelayable).toEqual(true)
  })

  it('sets group ID to the file ID', async () => {
    stepQueryResult.mockResolvedValueOnce({
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
    expect(Step.query).toHaveBeenCalled()
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
