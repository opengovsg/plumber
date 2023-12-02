import { afterEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'

import {
  exponentialBackoffWithJitterStrategy,
  INITIAL_DELAY_MS,
} from '../backoff'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: INITIAL_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
  ])(
    'applies jitter (delayInMs = $delayInMs)',
    ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      expect(exponentialBackoffWithJitterStrategy(1, null, err)).toEqual(
        expectedBaseDelay + expectedBaseDelay / 2,
      )
      expect(exponentialBackoffWithJitterStrategy(2, null, err)).toEqual(
        expectedBaseDelay * 2 /* Full delay for 1st retry */ +
          expectedBaseDelay /* 50% of full delay*/,
      )
      expect(exponentialBackoffWithJitterStrategy(3, null, err)).toEqual(
        expectedBaseDelay * 4 /* Full delay for 2nd retry */ +
          expectedBaseDelay * 2 /* 50% of full delay*/,
      )
    },
  )

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: INITIAL_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
  ])(
    'will wait at least the full duration of the previous default delay',
    ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)

      expect(exponentialBackoffWithJitterStrategy(1, null, err)).toEqual(
        expectedBaseDelay,
      )
      expect(exponentialBackoffWithJitterStrategy(2, null, err)).toEqual(
        expectedBaseDelay * 2,
      )
      expect(exponentialBackoffWithJitterStrategy(3, null, err)).toEqual(
        expectedBaseDelay * 4,
      )
      expect(exponentialBackoffWithJitterStrategy(4, null, err)).toEqual(
        expectedBaseDelay * 8,
      )
    },
  )

  it('reverts to default delay if specified delay is too small', () => {
    const err = new RetriableError({
      error: 'test error',
      delayInMs: 10,
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitterStrategy(1, null, err)).toEqual(
      INITIAL_DELAY_MS,
    )
    expect(exponentialBackoffWithJitterStrategy(2, null, err)).toEqual(
      INITIAL_DELAY_MS * 2,
    )
    expect(exponentialBackoffWithJitterStrategy(3, null, err)).toEqual(
      INITIAL_DELAY_MS * 4,
    )
  })

  it('reverts to default delay and logs if error is not RetriableError', () => {
    const err = new Error('test error')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitterStrategy(1, null, err)).toEqual(
      INITIAL_DELAY_MS,
    )
    expect(exponentialBackoffWithJitterStrategy(2, null, err)).toEqual(
      INITIAL_DELAY_MS * 2,
    )
    expect(exponentialBackoffWithJitterStrategy(3, null, err)).toEqual(
      INITIAL_DELAY_MS * 4,
    )
    expect(mocks.logError).toBeCalled()
  })
})
