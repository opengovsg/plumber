import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FLOW_REPEATABLE_JOB_NAME,
  flowIdFromRepeatableJob,
  getFlowRepeatableJobName,
  isRepeatableJobForFlow,
  reconcileInactiveFlowRepeatableJobs,
  removeFlowRepeatableJobs,
} from '../flow-repeatable-jobs'

const FLOW_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_FLOW_ID = '11111111-2222-4333-8444-555555555555'

const mocks = vi.hoisted(() => ({
  getRepeatableJobs: vi.fn(),
  removeRepeatableByKey: vi.fn(),
  waitUntilReady: vi.fn(),
  flowQuery: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('@/queues/flow', () => ({
  default: {
    getRepeatableJobs: mocks.getRepeatableJobs,
    removeRepeatableByKey: mocks.removeRepeatableByKey,
    waitUntilReady: mocks.waitUntilReady,
  },
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: mocks.flowQuery,
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.logInfo,
  },
}))

describe('flow-repeatable-jobs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getRepeatableJobs.mockResolvedValue([])
    mocks.removeRepeatableByKey.mockResolvedValue(undefined)
    mocks.waitUntilReady.mockResolvedValue(undefined)
  })

  describe('isRepeatableJobForFlow', () => {
    it('matches the pre-5.10 job.id field', () => {
      expect(
        isRepeatableJobForFlow(
          { key: 'other', id: FLOW_ID, name: 'unrelated' },
          FLOW_ID,
        ),
      ).toBe(true)
    })

    it('matches the job name used when publishing', () => {
      expect(
        isRepeatableJobForFlow(
          {
            key: 'md5-hash-without-uuid',
            name: getFlowRepeatableJobName(FLOW_ID),
          },
          FLOW_ID,
        ),
      ).toBe(true)
    })

    it('matches legacy concat keys even when id and name are missing', () => {
      expect(
        isRepeatableJobForFlow(
          { key: `flow-${FLOW_ID}:${FLOW_ID}:::*/15 * * * *` },
          FLOW_ID,
        ),
      ).toBe(true)
    })

    it('does not match a different flow', () => {
      expect(
        isRepeatableJobForFlow(
          {
            key: `flow-${OTHER_FLOW_ID}:${OTHER_FLOW_ID}:::0 * * * *`,
            id: OTHER_FLOW_ID,
            name: getFlowRepeatableJobName(OTHER_FLOW_ID),
          },
          FLOW_ID,
        ),
      ).toBe(false)
    })
  })

  describe('flowIdFromRepeatableJob', () => {
    it('prefers job.id', () => {
      expect(
        flowIdFromRepeatableJob({
          key: 'ignored',
          id: FLOW_ID,
          name: getFlowRepeatableJobName(OTHER_FLOW_ID),
        }),
      ).toBe(FLOW_ID)
    })

    it('parses the published job name', () => {
      expect(
        flowIdFromRepeatableJob({
          key: 'md5-hash',
          name: getFlowRepeatableJobName(FLOW_ID),
        }),
      ).toBe(FLOW_ID)
    })

    it('parses a legacy concat key', () => {
      expect(
        flowIdFromRepeatableJob({
          key: `flow-${FLOW_ID}:${FLOW_ID}:::0 * * * *`,
        }),
      ).toBe(FLOW_ID)
    })
  })

  describe('removeFlowRepeatableJobs', () => {
    it('removes every matching leftover key, not only job.id', async () => {
      mocks.getRepeatableJobs.mockResolvedValue([
        {
          key: 'md5-hash',
          name: `${FLOW_REPEATABLE_JOB_NAME}-${FLOW_ID}`,
        },
        {
          key: `flow-${FLOW_ID}:${FLOW_ID}:::*/15 * * * *`,
        },
        {
          key: `flow-${OTHER_FLOW_ID}:${OTHER_FLOW_ID}:::0 * * * *`,
          id: OTHER_FLOW_ID,
        },
      ])

      await removeFlowRepeatableJobs(FLOW_ID)

      expect(mocks.removeRepeatableByKey).toHaveBeenCalledWith('md5-hash')
      expect(mocks.removeRepeatableByKey).toHaveBeenCalledWith(
        `flow-${FLOW_ID}:${FLOW_ID}:::*/15 * * * *`,
      )
      expect(mocks.removeRepeatableByKey).not.toHaveBeenCalledWith(
        `flow-${OTHER_FLOW_ID}:${OTHER_FLOW_ID}:::0 * * * *`,
      )
    })

    it('does nothing when no matching job is listed', async () => {
      await removeFlowRepeatableJobs(FLOW_ID)

      expect(mocks.removeRepeatableByKey).not.toHaveBeenCalled()
    })
  })

  describe('reconcileInactiveFlowRepeatableJobs', () => {
    it('removes leftover jobs whose flows are inactive or missing', async () => {
      mocks.getRepeatableJobs.mockResolvedValue([
        {
          key: 'active-key',
          id: FLOW_ID,
          name: getFlowRepeatableJobName(FLOW_ID),
        },
        {
          key: 'inactive-key',
          id: OTHER_FLOW_ID,
          name: getFlowRepeatableJobName(OTHER_FLOW_ID),
        },
      ])
      mocks.flowQuery.mockReturnValue({
        select: vi.fn().mockReturnValue({
          whereIn: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: FLOW_ID }]),
          }),
        }),
      })

      const removed = await reconcileInactiveFlowRepeatableJobs()

      expect(removed).toBe(1)
      expect(mocks.removeRepeatableByKey).toHaveBeenCalledWith('inactive-key')
      expect(mocks.removeRepeatableByKey).not.toHaveBeenCalledWith('active-key')
    })
  })
})
