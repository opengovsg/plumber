import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TransientDBError from '@/errors/transient-db-error'

import {
  isTransientDbError,
  retryOnTransientDbError,
  throwAsTransientIfDbTransient,
} from '../retry-on-transient-db-error'

vi.mock('@/helpers/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

function pgError(overrides: Record<string, unknown> = {}): Error {
  return Object.assign(new Error((overrides.message as string) ?? 'pg boom'), {
    code: undefined,
    ...overrides,
  })
}

describe('isTransientDbError', () => {
  it('is true for SQLSTATE class 08 (connection exception)', () => {
    expect(isTransientDbError(pgError({ code: '08006' }))).toBe(true)
    expect(isTransientDbError(pgError({ code: '08003' }))).toBe(true)
    expect(isTransientDbError(pgError({ code: '08000' }))).toBe(true)
  })

  it('is true for SQLSTATE 57P0* (admin shutdown family)', () => {
    expect(isTransientDbError(pgError({ code: '57P01' }))).toBe(true)
    expect(isTransientDbError(pgError({ code: '57P02' }))).toBe(true)
    expect(isTransientDbError(pgError({ code: '57P03' }))).toBe(true)
  })

  it('is true for transient message substrings', () => {
    expect(isTransientDbError(new Error('read ECONNRESET'))).toBe(true)
    expect(isTransientDbError(new Error('connect ETIMEDOUT 10.0.0.1'))).toBe(
      true,
    )
    expect(isTransientDbError(new Error('Connection terminated'))).toBe(true)
  })

  it('honors nativeError.code on Objection-wrapped errors', () => {
    const native = pgError({ code: '08006', message: 'inner' })
    const err = Object.assign(new Error('wrapped'), { nativeError: native })
    expect(isTransientDbError(err)).toBe(true)
  })

  it('honors nativeError.message for substring matching', () => {
    const native = new Error('read ECONNRESET')
    const err = Object.assign(new Error('Query failed'), {
      nativeError: native,
    })
    expect(isTransientDbError(err)).toBe(true)
  })

  it('is false for unique violation (23505)', () => {
    expect(isTransientDbError(pgError({ code: '23505' }))).toBe(false)
  })

  it('is false for a plain Error with no transient signal', () => {
    expect(isTransientDbError(new Error('something else'))).toBe(false)
  })

  it('is false for null / undefined', () => {
    expect(isTransientDbError(null)).toBe(false)
    expect(isTransientDbError(undefined)).toBe(false)
  })
})

describe('throwAsTransientIfDbTransient', () => {
  it('throws TransientDBError when transient and within budget', () => {
    const err = pgError({ code: '08006', message: 'lost connection' })
    expect(() =>
      throwAsTransientIfDbTransient(err, { attemptsStarted: 0 }),
    ).toThrow(TransientDBError)
  })

  it('attaches errorCode + errorMessage on the thrown TransientDBError', () => {
    const err = pgError({ code: '08006', message: 'lost connection' })
    try {
      throwAsTransientIfDbTransient(err, {
        attemptsStarted: 1,
        context: 'processAction',
      })
      expect.fail('expected throw')
    } catch (caught) {
      expect(caught).toBeInstanceOf(TransientDBError)
      const t = caught as TransientDBError
      expect(t.errorCode).toBe('08006')
      expect(t.errorMessage).toBe('lost connection')
      expect(t.maxDelayMs).toBe(5000)
      expect(t.delayInMs).toBe(1000)
      expect(t.delayType).toBe('step')
    }
  })

  it('throws UnrecoverableError once the transient-DB budget is exhausted', () => {
    const err = pgError({ code: '08006' })
    expect(() =>
      throwAsTransientIfDbTransient(err, { attemptsStarted: 3 }),
    ).toThrow(UnrecoverableError)
  })

  it('rethrows the original error when not transient', () => {
    const original = new Error('not a db thing')
    expect(() =>
      throwAsTransientIfDbTransient(original, { attemptsStarted: 0 }),
    ).toThrow(original)
  })

  it('rethrows a unique violation unchanged (not transient)', () => {
    const err = pgError({ code: '23505' })
    expect(() =>
      throwAsTransientIfDbTransient(err, { attemptsStarted: 0 }),
    ).toThrow(err)
  })
})

describe('retryOnTransientDbError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the value on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(retryOnTransientDbError(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on transient errors and succeeds within the budget', async () => {
    vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const transient = pgError({ code: '08006' })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValue('ok')

    await expect(retryOnTransientDbError(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('rethrows immediately on a non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(retryOnTransientDbError(fn)).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('rethrows the transient error after the final attempt', async () => {
    vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    const transient = pgError({ code: '08006' })
    const fn = vi.fn().mockRejectedValue(transient)

    await expect(retryOnTransientDbError(fn)).rejects.toBe(transient)
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
