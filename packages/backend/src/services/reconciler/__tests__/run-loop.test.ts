import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type ReconcilerCheck, runReconcilerLoop } from '../run-loop'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  gauge: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    trace: vi.fn((_name: string, _options: unknown, fn: () => unknown) => fn()),
  },
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function makeCheck(
  overrides: Partial<ReconcilerCheck> = {},
): ReconcilerCheck & { run: ReturnType<typeof vi.fn> } {
  return {
    name: 'test-check',
    intervalSeconds: 60,
    run: vi.fn(async () => undefined),
    ...overrides,
  } as ReconcilerCheck & { run: ReturnType<typeof vi.fn> }
}

describe('runReconcilerLoop', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    exitSpy = vi.spyOn(process, 'exit')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    exitSpy.mockRestore()
  })

  it('runs every check at boot', async () => {
    const check = makeCheck()
    const loop = runReconcilerLoop({
      checks: [check],
      checkTimeoutSeconds: 30,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(check.run).toHaveBeenCalledTimes(1)

    await loop.stop()
  })

  it('keeps running other checks and its own next run when a check throws', async () => {
    const failing = makeCheck({
      name: 'failing',
      run: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const healthy = makeCheck({ name: 'healthy' })
    const loop = runReconcilerLoop({
      checks: [failing, healthy],
      checkTimeoutSeconds: 30,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(failing.run).toHaveBeenCalledTimes(2)
    expect(healthy.run).toHaveBeenCalledTimes(2)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Reconciler check failed',
      expect.objectContaining({ checkName: 'failing' }),
    )
    expect(exitSpy).not.toHaveBeenCalled()

    await loop.stop()
  })

  it('times out a slow check and schedules its next run', async () => {
    const check = makeCheck({
      run: vi.fn(() => new Promise<void>(() => undefined)),
    })
    const loop = runReconcilerLoop({
      checks: [check],
      checkTimeoutSeconds: 10,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(check.run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Reconciler check failed',
      expect.objectContaining({ checkName: 'test-check' }),
    )

    await vi.advanceTimersByTimeAsync(60_000)
    expect(check.run).toHaveBeenCalledTimes(2)

    const stopped = loop.stop()
    await vi.advanceTimersByTimeAsync(10_000)
    await stopped
  })

  it('never overlaps runs of one check', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const check = makeCheck({
      intervalSeconds: 1,
      run: vi.fn(async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 5_000))
        inFlight -= 1
      }),
    })
    const loop = runReconcilerLoop({
      checks: [check],
      checkTimeoutSeconds: 30,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(check.run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(check.run).toHaveBeenCalledTimes(2)
    expect(maxInFlight).toBe(1)

    await vi.advanceTimersByTimeAsync(5_000)
    await loop.stop()
  })

  it('runs each check on its own interval', async () => {
    const fast = makeCheck({ name: 'fast', intervalSeconds: 10 })
    const slow = makeCheck({ name: 'slow', intervalSeconds: 30 })
    const loop = runReconcilerLoop({
      checks: [fast, slow],
      checkTimeoutSeconds: 5,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fast.run).toHaveBeenCalledTimes(4)
    expect(slow.run).toHaveBeenCalledTimes(2)

    await loop.stop()
  })

  it('emits a gauge only after its check succeeds', async () => {
    let shouldFail = true
    const check = makeCheck({
      run: vi.fn(async () => {
        if (shouldFail) {
          throw new Error('query failed')
        }
        mocks.gauge()
      }),
    })
    const loop = runReconcilerLoop({
      checks: [check],
      checkTimeoutSeconds: 5,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.gauge).not.toHaveBeenCalled()

    shouldFail = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.gauge).toHaveBeenCalledTimes(1)

    await loop.stop()
  })

  it('starts no new run after stop and waits for running checks', async () => {
    const release = deferred()
    let finished = false
    const check = makeCheck({
      run: vi.fn(async () => {
        await release.promise
        finished = true
      }),
    })
    const loop = runReconcilerLoop({
      checks: [check],
      checkTimeoutSeconds: 30,
    })

    await vi.advanceTimersByTimeAsync(0)
    const stopped = loop.stop()
    let stopResolved = false
    void stopped.then(() => {
      stopResolved = true
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(stopResolved).toBe(false)

    release.resolve()
    await stopped
    expect(finished).toBe(true)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(check.run).toHaveBeenCalledTimes(1)
  })
})
