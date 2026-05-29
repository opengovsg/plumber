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
    // The batch feature flag is read at import time, so flag-on tests below
    // re-import the app module with a stubbed env. Reset both so later tests
    // (and other files) see the default flag-off module.
    vi.unstubAllEnvs()
    vi.resetModules()
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

  describe('createTableRow batch config', () => {
    it('does not expose a batch config when the flag is off', () => {
      // Default in the test env: M365_EXCEL_BATCH_ENABLED is unset. Flag-off
      // must leave the queue config byte-identical to today (no batch block).
      expect(m365ExcelApp.queue.batch).toBeUndefined()
    })

    // Re-import the queue config module directly (not the app index) to pick up
    // the flag-on env without dragging in the @/apps <-> app circular import.
    const importBatchQueueConfig = async () => {
      vi.stubEnv('M365_EXCEL_BATCH_ENABLED', 'true')
      vi.resetModules()
      return (await import('../queue')).default
    }

    it('exposes the batch config when the flag is on', async () => {
      const queue = await importBatchQueueConfig()

      expect(queue.batch).toMatchObject({
        size: 20,
        groupAffinity: true,
        actionKeys: ['createTableRow'],
      })
      expect(typeof queue.batch?.getGroupConfigForJob).toBe('function')
    })

    it('groups batches by (fileId, tableId, stepKey)', async () => {
      const queue = await importBatchQueueConfig()

      mocks.stepQueryResult.mockResolvedValueOnce({
        key: 'createTableRow',
        parameters: {
          fileId: 'mock-file-id',
          tableId: 'mock-table-id',
        },
      })

      const groupConfig = await queue.batch?.getGroupConfigForJob({
        flowId: 'test-flow-id',
        stepId: 'test-step-id',
        executionId: 'test-exec-id',
      })

      expect(groupConfig).toEqual({
        id: 'mock-file-id-mock-table-id-createTableRow',
      })
    })

    it('throws when the batched step is missing a tableId', async () => {
      const queue = await importBatchQueueConfig()

      mocks.stepQueryResult.mockResolvedValueOnce({
        key: 'createTableRow',
        parameters: {
          fileId: 'mock-file-id',
        },
      })

      await expect(
        queue.batch?.getGroupConfigForJob({
          flowId: 'test-flow-id',
          stepId: 'test-step-id',
          executionId: 'test-exec-id',
        }),
      ).rejects.toThrow(/tableId/)
    })
  })
})
