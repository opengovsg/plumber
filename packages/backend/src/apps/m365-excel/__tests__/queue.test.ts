// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'

import { afterEach, describe, expect, it, vi } from 'vitest'

import batchQueueConfig from '../queue/batch'
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

describe('Batch queue config', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets the batch group ID to fileId::tableId::connectionId', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      connectionId: 'conn-1',
      parameters: {
        fileId: 'mock-file-id',
        tableId: '{mock-table-id}',
      },
    })

    const groupConfig = await batchQueueConfig.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-execution-id',
    })

    // connectionId is in the key so a batch never mixes connections - that lets
    // runBatch authorize the whole batch with a single file-access check.
    expect(groupConfig).toEqual({
      id: 'mock-file-id::{mock-table-id}::conn-1',
    })
  })

  it('groups connection-less jobs together via an empty connection segment', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      connectionId: null,
      parameters: {
        fileId: 'mock-file-id',
        tableId: '{mock-table-id}',
      },
    })

    const groupConfig = await batchQueueConfig.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-execution-id',
    })

    // A missing connectionId is safe rather than thrown: such jobs share the
    // empty segment and runBatch's single access check fails them together.
    expect(groupConfig).toEqual({
      id: 'mock-file-id::{mock-table-id}::',
    })
  })
})
