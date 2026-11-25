import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  workerConstructor: vi.fn(function () {
    return { on: vi.fn(), close: vi.fn() }
  }),
  throwIfNotFound: vi.fn(),
  processFlow: vi.fn(async () => ({ data: [] as unknown[], error: null })),
  logInfo: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', () => ({
  WorkerPro: mocks.workerConstructor,
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: mocks.logInfo, warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: () => ({
      findById: () => ({ throwIfNotFound: mocks.throwIfNotFound }),
    }),
  },
}))

vi.mock('@/queues/trigger', () => ({
  default: { add: vi.fn() },
}))

vi.mock('@/services/flow', () => ({
  processFlow: mocks.processFlow,
}))

type Processor = (job: unknown) => Promise<void>

function makeJob(prevMillis?: number) {
  return {
    id: 'job-id',
    data: { flowId: 'flow-id' },
    opts: { prevMillis },
  }
}

function startedLogs() {
  return mocks.logInfo.mock.calls.filter(
    ([, meta]) => meta?.event === 'schedule-run-started',
  )
}

const NOW = new Date('2026-10-20T10:00:00.000Z').getTime()

describe('flow worker', () => {
  let processor: Processor

  beforeAll(async () => {
    await import('@/workers/flow')
    const calls = mocks.workerConstructor.mock.calls as unknown as unknown[][]
    processor = calls[0][1] as Processor
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.throwIfNotFound.mockResolvedValue({
      active: true,
      getTriggerStep: vi.fn(async () => ({ id: 'trigger-step-id' })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    mocks.logInfo.mockClear()
  })

  it('logs lateness against the intended cron time', async () => {
    await processor(makeJob(NOW - 1234))

    expect(startedLogs()).toEqual([
      [
        expect.any(String),
        {
          event: 'schedule-run-started',
          flowId: 'flow-id',
          jobId: 'job-id',
          flowActive: true,
          latenessMs: 1234,
        },
      ],
    ])
  })

  it('logs inactive flows with flowActive false', async () => {
    mocks.throwIfNotFound.mockResolvedValue({ active: false })

    await processor(makeJob(NOW))

    expect(startedLogs()).toEqual([
      [expect.any(String), expect.objectContaining({ flowActive: false })],
    ])
  })

  it('skips the log for jobs without a cron time', async () => {
    await processor(makeJob())

    expect(startedLogs()).toEqual([])
  })
})
