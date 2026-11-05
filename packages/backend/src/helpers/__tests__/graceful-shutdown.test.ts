import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  shutdownTelemetry: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/instrumentation', () => ({
  shutdownTelemetry: mocks.shutdownTelemetry,
}))
vi.mock('@/helpers/logger', () => ({
  default: { info: mocks.info, warn: mocks.warn, error: mocks.error },
}))

import { registerGracefulShutdown } from '../graceful-shutdown'

// Avoids SIGTERM and SIGINT, which the test runner may handle itself.
const SIGNALS: NodeJS.Signals[] = ['SIGUSR2', 'SIGHUP']

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.shutdownTelemetry.mockResolvedValue(undefined)
})

afterEach(() => {
  for (const signal of SIGNALS) {
    process.removeAllListeners(signal)
  }
})

describe('registerGracefulShutdown', () => {
  it('flushes telemetry only after every drain settles', async () => {
    let finishSlowDrain = () => {}
    const slowDrain = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSlowDrain = resolve
        }),
    )
    const fastDrain = vi.fn().mockResolvedValue(undefined)
    registerGracefulShutdown(SIGNALS, [slowDrain, fastDrain])

    process.emit('SIGUSR2')
    await flushPromises()

    expect(slowDrain).toHaveBeenCalledOnce()
    expect(fastDrain).toHaveBeenCalledOnce()
    expect(mocks.shutdownTelemetry).not.toHaveBeenCalled()

    finishSlowDrain()
    await flushPromises()

    expect(mocks.shutdownTelemetry).toHaveBeenCalledOnce()
  })

  it('still flushes telemetry when a drain rejects', async () => {
    registerGracefulShutdown(SIGNALS, [
      () => Promise.reject(new Error('Redis down')),
    ])

    process.emit('SIGUSR2')
    await flushPromises()

    expect(mocks.error).toHaveBeenCalledWith(
      'Failed to drain during shutdown',
      {
        error: 'Redis down',
      },
    )
    expect(mocks.shutdownTelemetry).toHaveBeenCalledOnce()
  })

  it('shuts down once when several signals arrive', async () => {
    const drain = vi.fn().mockResolvedValue(undefined)
    registerGracefulShutdown(SIGNALS, [drain])

    process.emit('SIGUSR2')
    process.emit('SIGHUP')
    await flushPromises()

    expect(drain).toHaveBeenCalledOnce()
    expect(mocks.shutdownTelemetry).toHaveBeenCalledOnce()
  })

  it('logs a failed telemetry flush', async () => {
    mocks.shutdownTelemetry.mockRejectedValue(new Error('HTTP 413'))
    registerGracefulShutdown(SIGNALS, [])

    process.emit('SIGUSR2')
    await flushPromises()

    expect(mocks.warn).toHaveBeenCalledWith(
      'Failed to flush AI telemetry during shutdown',
      { error: 'HTTP 413' },
    )
  })
})
