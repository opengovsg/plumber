import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  const span = { setTag: vi.fn() }
  return {
    span,
    tracerWrap: vi.fn((_name: string, fn: unknown) => fn),
    workerConstructor: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
    throwIfNotFound: vi.fn(),
    processFlow: vi.fn(async () => ({ data: [] as unknown[], error: null })),
  }
})

vi.mock('@taskforcesh/bullmq-pro', () => ({
  WorkerPro: mocks.workerConstructor,
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    wrap: mocks.tracerWrap,
    scope: () => ({ active: () => mocks.span }),
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
    mocks.span.setTag.mockClear()
  })

  it('wraps the processor in a workers.flow span', () => {
    expect(mocks.tracerWrap).toHaveBeenCalledWith(
      'workers.flow',
      expect.any(Function),
    )
  })

  it('tags lateness against the intended cron time', async () => {
    await processor(makeJob(NOW - 1234))

    expect(mocks.span.setTag).toHaveBeenCalledWith('schedule.lateness_ms', 1234)
  })

  it('tags lateness even when the flow lookup fails', async () => {
    mocks.throwIfNotFound.mockRejectedValue(new Error('not found'))

    await expect(processor(makeJob(NOW - 500))).rejects.toThrow('not found')

    expect(mocks.span.setTag).toHaveBeenCalledWith('schedule.lateness_ms', 500)
  })

  it('skips the lateness tag for jobs without a cron time', async () => {
    await processor(makeJob())

    expect(mocks.span.setTag).not.toHaveBeenCalledWith(
      'schedule.lateness_ms',
      expect.anything(),
    )
  })

  it.each([true, false])('tags flow.active as %s', async (active) => {
    mocks.throwIfNotFound.mockResolvedValue({
      active,
      getTriggerStep: vi.fn(async () => ({ id: 'trigger-step-id' })),
    })

    await processor(makeJob(NOW))

    expect(mocks.span.setTag).toHaveBeenCalledWith('flow.active', active)
  })
})
