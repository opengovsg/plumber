/**
 * Business-critical: late starts after a delay step count against the SLA.
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
    const query: unknown = new Proxy((): void => undefined, {
      get: (_target, prop): unknown =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve(value)
          : (): unknown => query,
    })
    return query
  }

  // Mimics Redis SET with NX, the only Redis behavior the rule depends on.
  const redisStore = new Map<string, string>()
  const redisSet = vi.fn(async (key: string, value: string, ...args) => {
    if (args.includes('NX') && redisStore.has(key)) {
      return null
    }
    redisStore.set(key, value)
    return 'OK'
  })

  return {
    queryResolving,
    redisStore,
    redisSet,
    incrementMetric: vi.fn(),
    enqueueActionJob: vi.fn(),
    getActionJob: vi.fn(),
    delayAsMilliseconds: vi.fn(),
    executionStepQuery: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
  getActionJob: mocks.getActionJob,
  makeActionJobId: (queueName: string, jobId: string) =>
    `${queueName}:${jobId}`,
}))

vi.mock('@/helpers/redis-app-data', () => ({
  redisAppDataClient: { set: mocks.redisSet },
  makeRedisAppDataKey: (app: string, key: string) => `${app}:${key}`,
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
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
  vi.unstubAllEnvs()
  mocks.redisStore.clear()
})

describe('recordLateScheduledStart', () => {
  const QUEUE_NAME = '{app-actions-slack}'

  async function loadRecordLateScheduledStart(graceSeconds?: string) {
    vi.stubEnv('DELAY_STEP_GRACE_SECONDS', graceSeconds)
    vi.resetModules()
    const { recordLateScheduledStart } =
      await import('../helpers/record-late-scheduled-start')
    return recordLateScheduledStart
  }

  function makeJob({
    id = 'job-1',
    executionId = 'execution-1',
    latenessMs,
    ...data
  }: {
    id?: string
    executionId?: string
    latenessMs?: number
    retryTimestamp?: number
  }) {
    return {
      id,
      data: {
        flowId: 'flow-1',
        executionId,
        stepId: 'step-2',
        ...(latenessMs === undefined ? {} : { scheduledAt: NOW - latenessMs }),
        ...data,
      },
    } as never
  }

  function lateCount(rateLimited = false) {
    return mocks.incrementMetric.mock.calls.filter(
      ([name, tags]) =>
        name === 'plumber.executions.late_after_delay' &&
        tags.rate_limited === String(rateLimited),
    ).length
  }

  it('counts a job starting 300,001 ms after scheduledAt once', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({ latenessMs: 300_001 }),
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).toHaveBeenCalledOnce()
    expect(lateCount()).toBe(1)
  })

  it('does not count a job starting exactly 300,000 ms after scheduledAt', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({ latenessMs: 300_000 }),
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })

  it('moves both bounds when the grace period changes', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart('600')

    for (const [executionId, latenessMs] of [
      ['execution-1', 300_001],
      ['execution-2', 600_000],
      ['execution-3', 600_001],
    ] as const) {
      await recordLateScheduledStart({
        job: makeJob({ id: executionId, executionId, latenessMs }),
        queueName: QUEUE_NAME,
        rateLimited: false,
      })
    }

    expect(mocks.incrementMetric).toHaveBeenCalledOnce()
    expect(mocks.redisStore.has('delay:late-execution:execution-3')).toBe(true)
  })

  it('does not count a job without scheduledAt', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({}),
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })

  it('does not count a job with retryTimestamp', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({ latenessMs: 3_600_000, retryTimestamp: NOW - 1_000 }),
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })

  it('does not count a second start of the same late job', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()
    const job = makeJob({ latenessMs: 400_000 })

    await recordLateScheduledStart({
      job,
      queueName: QUEUE_NAME,
      rateLimited: false,
    })
    vi.advanceTimersByTime(60_000)
    await recordLateScheduledStart({
      job,
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).toHaveBeenCalledOnce()
  })

  it('does not count a late re-run of a job whose first start was on time', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()
    const job = makeJob({ latenessMs: 1_000 })

    await recordLateScheduledStart({
      job,
      queueName: QUEUE_NAME,
      rateLimited: false,
    })
    vi.advanceTimersByTime(10 * 60_000)
    await recordLateScheduledStart({
      job,
      queueName: QUEUE_NAME,
      rateLimited: false,
    })

    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })

  it('counts a rate-limited late start as rate_limited:true', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({ latenessMs: 300_001 }),
      queueName: QUEUE_NAME,
      rateLimited: true,
    })

    expect(mocks.incrementMetric).toHaveBeenCalledOnce()
    expect(lateCount(true)).toBe(1)
  })

  it('does not count a second late step in the same execution', async () => {
    const recordLateScheduledStart = await loadRecordLateScheduledStart()

    await recordLateScheduledStart({
      job: makeJob({ id: 'job-1', latenessMs: 400_000 }),
      queueName: QUEUE_NAME,
      rateLimited: false,
    })
    await recordLateScheduledStart({
      job: makeJob({ id: 'job-2', latenessMs: 500_000 }),
      queueName: '{app-actions-m365-excel}',
      rateLimited: true,
    })

    expect(mocks.incrementMetric).toHaveBeenCalledOnce()
    expect(lateCount()).toBe(1)
  })
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
