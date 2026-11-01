import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordLateScheduledStart } from '../record-late-scheduled-start'

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

describe('recordLateScheduledStart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.redisSet.mockResolvedValue('OK')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('sets only the first-start marker per job', async () => {
    await recordLateScheduledStart({
      job: makeJob(400_000),
      queueName: '{app-actions-slack}',
      groupLimited: false,
    })

    expect(mocks.redisSet).toHaveBeenCalledExactlyOnceWith(
      'delay:first-start:{app-actions-slack}:42',
      '1',
      'EX',
      86_400,
      'NX',
    )
  })

  it('tags the active span with the lateness of an on-time start', async () => {
    await recordLateScheduledStart({
      job: makeJob(1_234),
      queueName: '{app-actions-slack}',
      groupLimited: false,
    })

    expect(mocks.setTag).toHaveBeenCalledWith('delay.lateness_ms', 1_234)
  })

  it('logs a late step with its context', async () => {
    await recordLateScheduledStart({
      job: makeJob(400_000),
      queueName: '{app-actions-slack}',
      groupLimited: true,
    })

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'step-started-late-after-delay',
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
      recordLateScheduledStart({
        job: makeJob(400_000),
        queueName: '{app-actions-slack}',
        groupLimited: false,
      }),
    ).resolves.toBeUndefined()

    expect(mocks.loggerError).toHaveBeenCalledOnce()
    expect(mocks.incrementMetric).not.toHaveBeenCalled()
  })
})
