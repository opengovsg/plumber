/**
 * Business-critical: overdue delayed jobs count against the SLA.
 *
 *   "For delayed jobs, anything that executed later than 5 mins past the
 *   scheduled time should count as failures in our SLA."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceAfterStep } from '../helpers/advance-after-step'

const NOW = new Date('2026-10-20T00:00:00.000Z').getTime()

const mocks = vi.hoisted(() => ({
  enqueueActionJob: vi.fn(),
  delayAsMilliseconds: vi.fn(),
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))

vi.mock('@/helpers/delay-as-milliseconds', () => ({
  default: mocks.delayAsMilliseconds,
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('advanceAfterStep', () => {
  async function advanceFrom(currStep: { appKey: string; key: string }) {
    await advanceAfterStep({
      processResult: {
        flowId: 'flow-1',
        executionId: 'execution-1',
        nextStep: { id: 'next-step-1', appKey: 'slack' } as never,
        executionStep: { isFailed: false, dataOut: {} } as never,
        nextStepMetadata: {},
        executionError: null,
      },
      currStep: { id: 'curr-step-1', ...currStep } as never,
      context: {
        isQueueDelayable: false,
        span: {} as never,
        worker: {} as never,
        job: {} as never,
      },
    })
    return mocks.enqueueActionJob.mock.calls[0][0].jobData
  }

  it.each(['delayFor', 'delayUntil'])(
    'sets scheduledAt for a %s step',
    async (key) => {
      mocks.delayAsMilliseconds.mockReturnValueOnce(60_000)

      const jobData = await advanceFrom({ appKey: 'delay', key })

      expect(jobData.scheduledAt).toBe(NOW + 60_000)
    },
  )

  it('sets scheduledAt to now when a past delayUntil target gives a negative delay', async () => {
    mocks.delayAsMilliseconds.mockReturnValueOnce(-1_500)

    const jobData = await advanceFrom({ appKey: 'delay', key: 'delayUntil' })

    expect(jobData.scheduledAt).toBe(NOW)
  })

  it('does not set scheduledAt for any other step', async () => {
    const jobData = await advanceFrom({
      appKey: 'toolbox',
      key: 'forEach',
    })

    expect(jobData).not.toHaveProperty('scheduledAt')
  })
})
