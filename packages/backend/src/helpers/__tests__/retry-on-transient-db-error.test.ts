import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isTransientDbError,
  retryOnTransientDbError,
} from '../retry-on-transient-db-error'

const mocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    warn: mocks.logWarn,
    error: vi.fn(),
    info: vi.fn(),
  },
}))

function makePgError(code: string): Error & { code: string } {
  const err = new Error(`pg error ${code}`) as Error & { code: string }
  err.code = code
  return err
}

function makeObjectionWrappedError(
  code: string,
): Error & { nativeError: { code: string } } {
  const err = new Error('DBError') as Error & {
    nativeError: { code: string }
  }
  err.nativeError = { code }
  return err
}

describe('isTransientDbError', () => {
  it.each([
    '08000',
    '08001',
    '08003',
    '08004',
    '08006',
    '57P01',
    '57P02',
    '57P03',
  ])('returns true for postgres SQLSTATE %s', (code) => {
    expect(isTransientDbError(makePgError(code))).toBe(true)
  })

  it.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND'])(
    'returns true for socket error %s',
    (code) => {
      expect(isTransientDbError(makePgError(code))).toBe(true)
    },
  )

  it('returns true when the transient code is on nativeError (Objection DBError)', () => {
    expect(isTransientDbError(makeObjectionWrappedError('57P01'))).toBe(true)
  })

  it.each(['23505', '23502', '23503', '08007', 'SOMETHING_ELSE'])(
    'returns false for non-transient code %s',
    (code) => {
      expect(isTransientDbError(makePgError(code))).toBe(false)
    },
  )

  it.each([
    'Connection terminated unexpectedly',
    'server closed the connection unexpectedly',
    // Case + surrounding context should still match.
    'Error: Connection terminated unexpectedly while idle',
  ])('returns true for transient pg driver message: %s', (message) => {
    expect(isTransientDbError(new Error(message))).toBe(true)
  })

  it.each([
    'connection terminated',
    'Client has encountered a connection error and is not queryable',
    'terminating connection due to administrator command',
  ])('returns false for messages not in the allowlist: %s', (message) => {
    expect(isTransientDbError(new Error(message))).toBe(false)
  })

  it('matches a transient message when wrapped by Objection (nativeError.message)', () => {
    const err = new Error('DBError') as Error & {
      nativeError: { message: string }
    }
    err.nativeError = { message: 'Connection terminated unexpectedly' }
    expect(isTransientDbError(err)).toBe(true)
  })

  it('returns false for an unrelated message without a code', () => {
    expect(isTransientDbError(new Error('boom'))).toBe(false)
  })

  it('returns false for non-error values', () => {
    expect(isTransientDbError(null)).toBe(false)
    expect(isTransientDbError(undefined)).toBe(false)
    expect(isTransientDbError('string')).toBe(false)
  })
})

describe('retryOnTransientDbError', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    mocks.logWarn.mockReset()
  })

  it('returns the value on first try without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    await expect(retryOnTransientDbError(fn)).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(mocks.logWarn).not.toHaveBeenCalled()
  })

  it('retries after a transient failure and succeeds', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const fn = vi
      .fn()
      .mockRejectedValueOnce(makePgError('57P01'))
      .mockResolvedValueOnce('ok')

    const promise = retryOnTransientDbError(fn, {
      initialDelayMs: 100,
      maxDelayMs: 1000,
      context: { flowId: 'flow-1' },
    })

    // First attempt rejects synchronously on the microtask queue.
    await vi.advanceTimersByTimeAsync(0)
    // Backoff of 100ms (Math.random() => 0) before the retry.
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(mocks.logWarn).toHaveBeenCalledTimes(1)
    expect(mocks.logWarn).toHaveBeenCalledWith(
      'Retrying DB operation after transient error',
      expect.objectContaining({
        event: 'db-retry',
        attempt: 1,
        nextAttempt: 2,
        maxAttempts: 3,
        errorCode: '57P01',
        delayMs: 100,
        flowId: 'flow-1',
      }),
    )
  })

  it('throws after exhausting maxAttempts on repeated transient errors', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const err = makePgError('08006')
    const fn = vi.fn().mockRejectedValue(err)

    const promise = retryOnTransientDbError(fn, {
      initialDelayMs: 100,
      maxDelayMs: 1000,
    })
    // Swallow unhandled rejection while we advance timers.
    promise.catch((): undefined => undefined)

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100) // first backoff
    await vi.advanceTimersByTimeAsync(200) // second backoff

    await expect(promise).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(mocks.logWarn).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-transient errors', async () => {
    const err = makePgError('23505') // unique_violation
    const fn = vi.fn().mockRejectedValue(err)

    await expect(retryOnTransientDbError(fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mocks.logWarn).not.toHaveBeenCalled()
  })

  it('respects a custom maxAttempts', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const err = makePgError('57P01')
    const fn = vi.fn().mockRejectedValue(err)

    const promise = retryOnTransientDbError(fn, {
      maxAttempts: 2,
      initialDelayMs: 100,
    })
    promise.catch((): undefined => undefined)

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(mocks.logWarn).toHaveBeenCalledTimes(1)
  })

  it('caps the actual sleep delay at maxDelayMs even with maximum jitter', async () => {
    vi.useFakeTimers()
    // Max jitter — without a cap on the final delay this would be 2 * prevFullDelay.
    vi.spyOn(Math, 'random').mockReturnValue(1)

    const err = makePgError('57P01')
    const fn = vi.fn().mockRejectedValue(err)

    const promise = retryOnTransientDbError(fn, {
      maxAttempts: 4,
      initialDelayMs: 100,
      maxDelayMs: 300,
    })
    promise.catch((): undefined => undefined)

    await vi.advanceTimersByTimeAsync(0)
    // attempt 1: prevFull=100, delay=100+100=200 (below cap)
    await vi.advanceTimersByTimeAsync(200)
    // attempt 2: prevFull=200, delay=200+200=400 → capped to 300
    await vi.advanceTimersByTimeAsync(300)
    // attempt 3: prevFull=300 (capped), delay=300+300=600 → capped to 300
    await vi.advanceTimersByTimeAsync(300)

    await expect(promise).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(4)

    const loggedDelays = mocks.logWarn.mock.calls.map(
      ([, payload]) => (payload as { delayMs: number }).delayMs,
    )
    expect(loggedDelays).toEqual([200, 300, 300])
    for (const delay of loggedDelays) {
      expect(delay).toBeLessThanOrEqual(300)
    }
  })

  it('unwraps Objection-wrapped transient errors', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeObjectionWrappedError('57P01'))
      .mockResolvedValueOnce('ok')

    const promise = retryOnTransientDbError(fn, { initialDelayMs: 100 })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
