import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addFlowRepeatableJob,
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
  add: vi.fn(),
  getRepeatableJobs: vi.fn(),
  removeRepeatableByKey: vi.fn(),
  removeJobScheduler: vi.fn(),
  getJobSchedulers: vi.fn(),
  waitUntilReady: vi.fn(),
  flowQuery: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('@/queues/flow', () => ({
  default: {
    add: mocks.add,
    getRepeatableJobs: mocks.getRepeatableJobs,
    removeRepeatableByKey: mocks.removeRepeatableByKey,
    removeJobScheduler: mocks.removeJobScheduler,
    getJobSchedulers: mocks.getJobSchedulers,
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
    mocks.getJobSchedulers.mockResolvedValue([])
    mocks.removeRepeatableByKey.mockResolvedValue(undefined)
    mocks.removeJobScheduler.mockResolvedValue(undefined)
    mocks.add.mockResolvedValue(undefined)
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

    it('matches a custom scheduler key equal to the flow id', () => {
      expect(isRepeatableJobForFlow({ key: FLOW_ID }, FLOW_ID)).toBe(true)
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

  describe('addFlowRepeatableJob', () => {
    it('enqueues a repeatable job named after the flow', async () => {
      await addFlowRepeatableJob(FLOW_ID, '0 * * * *')

      expect(mocks.add).toHaveBeenCalledWith(
        `${FLOW_REPEATABLE_JOB_NAME}-${FLOW_ID}`,
        { flowId: FLOW_ID },
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
          jobId: FLOW_ID,
        }),
      )
    })
  })

  describe('removeFlowRepeatableJobs', () => {
    it('removes every matching leftover key, not only job.id', async () => {
      mocks.getRepeatableJobs.mockResolvedValue([
        { key: 'md5-hash', name: getFlowRepeatableJobName(FLOW_ID) },
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
      expect(mocks.removeRepeatableByKey).toHaveBeenCalledWith(FLOW_ID)
      expect(mocks.removeRepeatableByKey).not.toHaveBeenCalledWith(
        `flow-${OTHER_FLOW_ID}:${OTHER_FLOW_ID}:::0 * * * *`,
      )
      expect(mocks.removeJobScheduler).toHaveBeenCalledWith('md5-hash')
      expect(mocks.removeJobScheduler).toHaveBeenCalledWith(FLOW_ID)
    })

    it('still tries the flow id when nothing is listed', async () => {
      await removeFlowRepeatableJobs(FLOW_ID)

      expect(mocks.removeRepeatableByKey).toHaveBeenCalledWith(FLOW_ID)
      expect(mocks.removeJobScheduler).toHaveBeenCalledWith(FLOW_ID)
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
