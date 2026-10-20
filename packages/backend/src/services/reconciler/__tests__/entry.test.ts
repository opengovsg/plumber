import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  const finishListeners: Array<() => void> = []
  return {
    finishListeners,
    runChecksOnce: vi.fn(async (): Promise<boolean> => true),
    createReconcilerChecks: vi.fn(() => ['schedule check']),
    redisQuit: vi.fn(async () => 'OK'),
    appDataRedisQuit: vi.fn(async () => 'OK'),
    logReconcilerRedisErrors: vi.fn(),
    knexDestroy: vi.fn(async () => undefined),
    logInfo: vi.fn(),
    logError: vi.fn(),
    logOnce: vi.fn((event: string, listener: () => void) => {
      if (event === 'finish') {
        finishListeners.push(listener)
      }
    }),
    logEnd: vi.fn(() => {
      for (const listener of finishListeners.splice(0)) {
        listener()
      }
    }),
  }
})

vi.mock('@/helpers/tracer', () => ({ default: {} }))
vi.mock('@/config/orm', () => ({}))
vi.mock('@/config/database', () => ({
  client: { destroy: mocks.knexDestroy },
}))
vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.logInfo,
    error: mocks.logError,
    warn: vi.fn(),
    once: mocks.logOnce,
    end: mocks.logEnd,
  },
}))
vi.mock('@/services/reconciler/redis', () => ({
  createReconcilerRedisClient: vi.fn(() => ({ quit: mocks.redisQuit })),
  logReconcilerRedisErrors: mocks.logReconcilerRedisErrors,
}))
vi.mock('@/helpers/redis-app-data', () => ({
  redisAppDataClient: { quit: mocks.appDataRedisQuit },
}))
vi.mock('@/services/reconciler/checks', () => ({
  createReconcilerChecks: mocks.createReconcilerChecks,
}))
vi.mock('@/services/reconciler/run-checks', () => ({
  runChecksOnce: mocks.runChecksOnce,
}))

type Handler = (...args: unknown[]) => unknown

const RUN_DEADLINE_MILLIS = 300_000
const CLOSE_WAIT_MILLIS = 20_000

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined)
}

describe('reconciler entry', () => {
  const handlers = new Map<string, Handler>()
  let processOn: ReturnType<typeof vi.spyOn>
  let processExit: ReturnType<typeof vi.spyOn>

  async function startReconciler(): Promise<void> {
    handlers.clear()
    vi.resetModules()
    await import('@/reconciler')
  }

  beforeAll(() => {
    processOn = vi.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: Handler,
    ) => {
      handlers.set(event, handler)
      return process
    }) as typeof process.on)
    processExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as typeof process.exit)
  })

  afterAll(() => {
    processOn.mockRestore()
    processExit.mockRestore()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mocks.finishListeners.length = 0
  })

  it('exits 0 after the checks succeed, the connections close and the logger flushes', async () => {
    await startReconciler()
    await vi.advanceTimersByTimeAsync(0)

    expect(mocks.runChecksOnce).toHaveBeenCalledWith({
      checks: ['schedule check'],
    })
    expect(processExit).toHaveBeenCalledTimes(1)
    expect(processExit).toHaveBeenCalledWith(0)

    expect(mocks.appDataRedisQuit).toHaveBeenCalled()

    const [destroyOrder] = mocks.knexDestroy.mock.invocationCallOrder
    const [quitOrder] = mocks.redisQuit.mock.invocationCallOrder
    const [endOrder] = mocks.logEnd.mock.invocationCallOrder
    const [exitOrder] = processExit.mock.invocationCallOrder
    expect(destroyOrder).toBeLessThan(quitOrder)
    expect(quitOrder).toBeLessThan(endOrder)
    expect(endOrder).toBeLessThan(exitOrder)
  })

  it('exits 1 when a check fails', async () => {
    mocks.runChecksOnce.mockResolvedValueOnce(false)

    await startReconciler()
    await vi.advanceTimersByTimeAsync(0)

    expect(mocks.knexDestroy).toHaveBeenCalled()
    expect(mocks.logEnd).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledTimes(1)
    expect(processExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 and logs the deadline when the run passes it', async () => {
    mocks.runChecksOnce.mockReturnValueOnce(never())

    await startReconciler()
    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MILLIS - 1)
    expect(processExit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ event: 'reconciler-run-deadline' }),
    )
    expect(mocks.redisQuit).toHaveBeenCalled()
    expect(mocks.logEnd).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledWith(1)
  })

  it('counts missed runs on the app data Redis and logs its errors', async () => {
    await startReconciler()
    await vi.advanceTimersByTimeAsync(0)

    expect(mocks.createReconcilerChecks).toHaveBeenCalledWith(
      expect.objectContaining({
        markerRedis: expect.objectContaining({
          quit: mocks.appDataRedisQuit,
        }),
      }),
    )
    expect(mocks.logReconcilerRedisErrors).toHaveBeenCalledWith(
      expect.objectContaining({ quit: mocks.appDataRedisQuit }),
    )
  })

  it('exits after the close wait when closing a connection hangs', async () => {
    mocks.redisQuit.mockReturnValueOnce(never())

    await startReconciler()
    await vi.advanceTimersByTimeAsync(CLOSE_WAIT_MILLIS - 1)
    expect(processExit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.logEnd).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledWith(0)
  })

  it('exits 1 at the deadline when the logger never flushes', async () => {
    mocks.logEnd.mockImplementationOnce(() => undefined)

    await startReconciler()
    await vi.advanceTimersByTimeAsync(0)
    expect(processExit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MILLIS)

    expect(processExit).toHaveBeenCalledWith(1)
  })

  it.each(['uncaughtException', 'unhandledRejection'])(
    'exits 1 on %s',
    async (event) => {
      mocks.runChecksOnce.mockReturnValueOnce(never())
      await startReconciler()

      handlers.get(event)?.(new Error('boom'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mocks.logError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ event: 'reconciler-fatal-error' }),
      )
      expect(mocks.logEnd).toHaveBeenCalled()
      expect(processExit).toHaveBeenCalledTimes(1)
      expect(processExit).toHaveBeenCalledWith(1)
    },
  )

  it('exits 1 on SIGTERM', async () => {
    mocks.runChecksOnce.mockReturnValueOnce(never())
    await startReconciler()

    handlers.get('SIGTERM')?.()
    await vi.advanceTimersByTimeAsync(0)

    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ event: 'reconciler-stopped' }),
    )
    expect(mocks.knexDestroy).toHaveBeenCalled()
    expect(mocks.redisQuit).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledTimes(1)
    expect(processExit).toHaveBeenCalledWith(1)
  })

  it('exits 1 when a run that succeeded fails while closing connections', async () => {
    mocks.redisQuit.mockReturnValueOnce(never())
    await startReconciler()
    await vi.advanceTimersByTimeAsync(0)

    handlers.get('SIGTERM')?.()
    await vi.advanceTimersByTimeAsync(CLOSE_WAIT_MILLIS)

    expect(processExit).toHaveBeenCalledTimes(1)
    expect(processExit).toHaveBeenCalledWith(1)
  })
})
