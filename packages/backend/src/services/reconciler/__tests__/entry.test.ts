import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  loopStop: vi.fn(async () => undefined),
  runReconcilerLoop: vi.fn(),
  createReconcilerChecks: vi.fn(() => ['schedule check']),
  redisQuit: vi.fn(async () => 'OK'),
  knexDestroy: vi.fn(async () => undefined),
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/helpers/tracer', () => ({ default: {} }))
vi.mock('@/config/orm', () => ({}))
vi.mock('@/config/database', () => ({
  client: { destroy: mocks.knexDestroy },
}))
vi.mock('@/helpers/logger', () => ({
  default: { info: mocks.logInfo, error: mocks.logError, warn: vi.fn() },
}))
vi.mock('@/services/reconciler/redis', () => ({
  createReconcilerRedisClient: vi.fn(() => ({ quit: mocks.redisQuit })),
}))
vi.mock('@/services/reconciler/checks', () => ({
  createReconcilerChecks: mocks.createReconcilerChecks,
}))
vi.mock('@/services/reconciler/run-loop', () => ({
  runReconcilerLoop: mocks.runReconcilerLoop,
}))

type Handler = (...args: unknown[]) => unknown

describe('reconciler entry', () => {
  const handlers = new Map<string, Handler>()
  let processOn: ReturnType<typeof vi.spyOn>
  let processExit: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    mocks.runReconcilerLoop.mockReturnValue({ stop: mocks.loopStop })
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

    await import('@/reconciler')
  })

  afterAll(() => {
    processOn.mockRestore()
    processExit.mockRestore()
  })

  beforeEach(() => {
    processExit.mockClear()
  })

  it('starts the loop with the reconciler checks', () => {
    expect(mocks.runReconcilerLoop).toHaveBeenCalledWith(
      expect.objectContaining({ checks: ['schedule check'] }),
    )
  })

  it('exits with code 1 on an uncaught exception', () => {
    handlers.get('uncaughtException')?.(new Error('boom'))

    expect(mocks.logError).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledWith(1)
  })

  it('exits with code 1 on an unhandled rejection', () => {
    handlers.get('unhandledRejection')?.(new Error('boom'))

    expect(processExit).toHaveBeenCalledWith(1)
  })

  it('stops the loop and closes connections on SIGTERM', async () => {
    await handlers.get('SIGTERM')?.()

    expect(mocks.loopStop).toHaveBeenCalled()
    expect(mocks.knexDestroy).toHaveBeenCalled()
    expect(mocks.redisQuit).toHaveBeenCalled()
    expect(processExit).toHaveBeenCalledWith(0)
  })
})
