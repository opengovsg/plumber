import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SCHEDULER_MAX_DELAY_IN_MS } from '@/apps/scheduler/common/constants'

import {
  acquireCoordinationLock,
  calculateDelays,
  moveJobToTriggerQueue,
} from '../helpers/buffer-scheduleded-jobs'

const mocks = vi.hoisted(() => ({
  redisSet: vi.fn(),
  flowQueryResult: vi.fn(),
  getTriggerStep: vi.fn(),
  processFlow: vi.fn(),
  triggerQueueAdd: vi.fn(),
}))

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    set: mocks.redisSet,
  })),
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: () => ({
      findById: vi.fn(() => ({
        throwIfNotFound: mocks.flowQueryResult,
      })),
    }),
  },
}))

vi.mock('@/queues/trigger', () => ({
  default: {
    add: mocks.triggerQueueAdd,
  },
}))

vi.mock('@/services/flow', () => ({
  processFlow: mocks.processFlow,
}))

describe('buffer-scheduled-jobs', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('acquireCoordinationLock', () => {
    const timestamp = new Date().getTime()
    it('should return true when lock is acquired', async () => {
      mocks.redisSet.mockResolvedValue('OK')
      const result = await acquireCoordinationLock(timestamp.toString())
      expect(result).toBe(true)
      expect(mocks.redisSet).toHaveBeenCalledWith(
        `buffer-lock:${timestamp}`,
        '1',
        'PX',
        SCHEDULER_MAX_DELAY_IN_MS,
        'NX',
      )
    })

    it('should return false when lock is not acquired', async () => {
      mocks.redisSet.mockResolvedValue(null)
      const result = await acquireCoordinationLock(timestamp.toString())
      expect(result).toBe(false)
    })
  })

  describe('calculateDelays', () => {
    it('should return [0] for single job', () => {
      const result = calculateDelays(1)
      expect(result).toEqual([0])
    })

    it.each([
      {
        count: 2,
        expected: [0, 600000],
      },
      {
        count: 3,
        expected: [0, 600000, 1200000],
      },
      {
        count: 4,
        expected: [0, 600000, 1200000, 1800000],
      },
      {
        count: 10,
        expected: [
          0, 200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000,
          1800000,
        ],
      },
    ])('should spread jobs evenly over max delay', ({ count, expected }) => {
      const result = calculateDelays(count)
      expect(result).toEqual(expected)
    })
  })

  describe('moveJobToTriggerQueue', () => {
    const mockFlow = {
      id: 'flow-1',
      getTriggerStep: mocks.getTriggerStep,
    }
    const mockTriggerStep = { id: 'trigger-1' }
    const mockData = [
      { meta: { internalId: '1' } },
      { meta: { internalId: '2' } },
    ]

    beforeEach(() => {
      mocks.flowQueryResult.mockResolvedValue(mockFlow)
      mocks.getTriggerStep.mockResolvedValue(mockTriggerStep)
      mocks.processFlow.mockResolvedValue({ data: mockData, error: null })
    })

    it('should add jobs to trigger queue with correct delays', async () => {
      await moveJobToTriggerQueue('flow-1', 1000)

      expect(mocks.triggerQueueAdd).toHaveBeenCalledTimes(2)
      expect(mocks.triggerQueueAdd).toHaveBeenNthCalledWith(
        1,
        'trigger-1-2',
        {
          flowId: 'flow-1',
          stepId: 'trigger-1',
          triggerItem: { meta: { internalId: '2' } },
        },
        expect.objectContaining({
          delay: 1000,
        }),
      )
      expect(mocks.triggerQueueAdd).toHaveBeenNthCalledWith(
        2,
        'trigger-1-1',
        {
          flowId: 'flow-1',
          stepId: 'trigger-1',
          triggerItem: { meta: { internalId: '1' } },
        },
        expect.objectContaining({
          delay: 1000,
        }),
      )
    })

    it('should add error job when processFlow returns error', async () => {
      const error = new Error('Test error')
      mocks.processFlow.mockResolvedValue({ data: [], error })

      await moveJobToTriggerQueue('flow-1', 1000)

      expect(mocks.triggerQueueAdd).toHaveBeenCalledTimes(1)
      expect(mocks.triggerQueueAdd).toHaveBeenCalledWith(
        'trigger-1-error',
        {
          flowId: 'flow-1',
          stepId: 'trigger-1',
          error,
        },
        expect.objectContaining({
          delay: 1000,
        }),
      )
    })

    it('should throw if flow is not found', async () => {
      mocks.flowQueryResult.mockRejectedValue(new Error('Flow not found'))
      await expect(moveJobToTriggerQueue('flow-1', 1000)).rejects.toThrow(
        'Flow not found',
      )
    })
  })
})
