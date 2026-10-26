import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordOverdueExecution } from '../record-overdue-execution'

const NOW = new Date('2026-10-20T00:00:00.000Z').getTime()

const mocks = vi.hoisted(() => ({
  redisSet: vi.fn(),
  incrementMetric: vi.fn(),
  setTag: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/redis-app-data', () => ({
  redisAppDataClient: { set: mocks.redisSet },
  makeRedisAppDataKey: (app: string, key: string) => `${app}:${key}`,
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
}))

vi.mock('@/helpers/tracer', () => ({
  default: { scope: () => ({ active: () => ({ setTag: mocks.setTag }) }) },
}))

vi.mock('@/helpers/logger', () => ({
  default: { warn: mocks.loggerWarn, error: mocks.loggerError },
}))

vi.mock('@/queues/action', () => ({
  makeActionJobId: (queueName: string, jobId: string) =>
    `${queueName}:${jobId}`,
}))

function makeJob(latenessMs: number) {
  return {
    id: '42',
    data: {
      flowId: 'flow-1',
      executionId: 'execution-1',
      stepId: 'step-2',
      scheduledAt: NOW - latenessMs,
    },
  } as never
}

describe('recordOverdueExecution', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.redisSet.mockResolvedValue('OK')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sets the first-start marker per job and the overdue marker per execution', async () => {
    await recordOverdueExecution({
      job: makeJob(400_000),
      queueName: '{app-actions-slack}',
      groupLimited: false,
    })

    expect(mocks.redisSet).toHaveBeenNthCalledWith(
      1,
      'delay:first-start:{app-actions-slack}:42',
      '1',
      'EX',
      86_400,
      'NX',
    )
    expect(mocks.redisSet).toHaveBeenNthCalledWith(
      2,
      'delay:overdue-execution:execution-1',
      '1',
      'EX',
      2_592_000,
      'NX',
    )
  })

  it('tags the active span with the lateness of an on-time start', async () => {
    await recordOverdueExecution({
      job: makeJob(1_234),
      queueName: '{app-actions-slack}',
      groupLimited: false,
    })

    expect(mocks.setTag).toHaveBeenCalledWith('delay.lateness_ms', 1_234)
  })

  it('logs an overdue execution with its context', async () => {
    await recordOverdueExecution({
      job: makeJob(400_000),
      queueName: '{app-actions-slack}',
      groupLimited: true,
    })

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'overdue-execution',
        flowId: 'flow-1',
        executionId: 'execution-1',
        stepId: 'step-2',
        queueName: '{app-actions-slack}',
        groupLimited: true,
        latenessMs: 400_000,
      }),
    )
  })

  it('logs and swallows Redis errors', async () => {
    mocks.redisSet.mockRejectedValueOnce(new Error('connection lost'))

    await expect(
      recordOverdueExecution({
        job: makeJob(400_000),
        queueName: '{app-actions-slack}',
        groupLimited: false,
      }),
    ).resolves.toBeUndefined()

    expect(mocks.loggerError).toHaveBeenCalledOnce()
    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })
})
