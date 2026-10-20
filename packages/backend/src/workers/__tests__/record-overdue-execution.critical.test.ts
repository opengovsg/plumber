/**
 * Business-critical: overdue delayed jobs count against the SLA.
 *
 *   "For delayed jobs, anything that executed later than 5 mins past the
 *   scheduled time should count as failures in our SLA."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import bulkRetryExecutions from '@/graphql/mutations/bulk-retry-executions'
import bulkRetryIterations from '@/graphql/mutations/bulk-retry-iterations'

import { advanceAfterStep } from '../helpers/advance-after-step'

const NOW = new Date('2026-10-20T00:00:00.000Z').getTime()

const mocks = vi.hoisted(() => {
  // Stands in for any Objection query chain and resolves to `value` when awaited.
  function queryResolving(value: unknown): unknown {
    const query: unknown = new Proxy(() => undefined, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve(value)
          : () => query,
    })
    return query
  }

  return {
    queryResolving,
    enqueueActionJob: vi.fn(),
    getActionJob: vi.fn(),
    delayAsMilliseconds: vi.fn(),
    executionStepQuery: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
  getActionJob: mocks.getActionJob,
}))

vi.mock('@/models/execution', () => ({
  default: { query: () => mocks.queryResolving([{ id: 'execution-1' }]) },
}))

vi.mock('@/models/execution-step', () => ({
  default: { query: mocks.executionStepQuery },
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

describe('bulk retry', () => {
  const jobData = {
    flowId: 'flow-1',
    executionId: 'execution-1',
    stepId: 'step-1',
    metadata: { iteration: 1 },
    scheduledAt: NOW - 3 * 24 * 60 * 60 * 1000,
  }

  beforeEach(() => {
    mocks.executionStepQuery.mockReturnValue(
      mocks.queryResolving([
        {
          id: 'execution-step-1',
          executionId: 'execution-1',
          status: 'failure',
          jobId: 'old-job-1',
          appKey: 'slack',
          key: 'sendMessage',
          metadata: { iteration: 1 },
          $query: () => mocks.queryResolving(1),
        },
      ]),
    )
    mocks.getActionJob.mockResolvedValue({
      id: 'old-job-1',
      name: 'execution-1-step-1',
      data: jobData,
      getState: vi.fn().mockResolvedValue('failed'),
      remove: vi.fn(),
    })
    mocks.enqueueActionJob.mockResolvedValue({ id: 'new-job-1' })
  })

  const context = {
    currentUser: {
      email: 'user@example.gov.sg',
      $relatedQuery: () => mocks.queryResolving([{ id: 'execution-1' }]),
    },
  }

  it.each([
    {
      name: 'bulkRetryExecutions',
      retry: () =>
        bulkRetryExecutions(
          {},
          { input: { flowId: 'flow-1' } },
          context as never,
          {} as never,
        ),
    },
    {
      name: 'bulkRetryIterations',
      retry: () =>
        bulkRetryIterations(
          {},
          { input: { executionId: 'execution-1' } },
          context as never,
          {} as never,
        ),
    },
  ])('$name drops scheduledAt from the re-enqueued job', async ({ retry }) => {
    await retry()

    const { scheduledAt: _scheduledAt, ...rest } = jobData
    expect(mocks.enqueueActionJob).toHaveBeenCalledOnce()
    expect(mocks.enqueueActionJob.mock.calls[0][0].jobData).toEqual(rest)
  })
})
