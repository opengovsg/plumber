import { afterEach, describe, expect, it, vi } from 'vitest'

import RetriableError, { DEFAULT_DELAY_MS } from '@/errors/retriable-error'

import { exponentialBackoffWithJitter } from '../backoff'

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
    info: vi.fn(),
  },
}))

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: DEFAULT_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
    { delayInMs: 1, expectedBaseDelay: 1 },
  ])(
    'applies jitter (delayInMs = $delayInMs)',
    ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      expect(exponentialBackoffWithJitter(1, null, err)).toEqual(
        Math.round(expectedBaseDelay + expectedBaseDelay / 2),
      )
      expect(exponentialBackoffWithJitter(2, null, err)).toEqual(
        Math.round(
          expectedBaseDelay * 2 /* Full delay for 1st retry */ +
            expectedBaseDelay /* 50% of full delay*/,
        ),
      )
      expect(exponentialBackoffWithJitter(3, null, err)).toEqual(
        Math.round(
          expectedBaseDelay * 4 /* Full delay for 2nd retry */ +
            expectedBaseDelay * 2 /* 50% of full delay*/,
        ),
      )
    },
  )

  it.each([
    {
      delayInMs: 'default' as const,
      expectedBaseDelay: DEFAULT_DELAY_MS,
    },
    { delayInMs: 5000, expectedBaseDelay: 5000 },
    { delayInMs: 1, expectedBaseDelay: 1 },
  ])(
    'will wait at least the full duration of the previous default delay',
    ({ delayInMs, expectedBaseDelay }) => {
      const err = new RetriableError({
        error: 'test error',
        delayInMs,
        delayType: 'step',
      })
      vi.spyOn(Math, 'random').mockReturnValue(0)

      expect(exponentialBackoffWithJitter(1, null, err)).toEqual(
        expectedBaseDelay,
      )
      expect(exponentialBackoffWithJitter(2, null, err)).toEqual(
        expectedBaseDelay * 2,
      )
      expect(exponentialBackoffWithJitter(3, null, err)).toEqual(
        expectedBaseDelay * 4,
      )
      expect(exponentialBackoffWithJitter(4, null, err)).toEqual(
        expectedBaseDelay * 8,
      )
    },
  )

  it("uses RetriableError's default delay and logs if error is not RetriableError", () => {
    const err = new Error('test error')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitter(1, null, err)).toEqual(DEFAULT_DELAY_MS)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Triggered BullMQ retry without RetriableError',
      { event: 'bullmq-retry-without-retriable-error' },
    )
  })

  it('logs if error is RetriableError with non-step delayType', () => {
    const err = new RetriableError({
      error: 'test error',
      delayInMs: 10,
      delayType: 'queue',
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitter(1, null, err)).toEqual(10)
    expect(mocks.logError).toHaveBeenCalledWith(
      'Triggered BullMQ retry with RetriableError of the wrong delay type',
      {
        event: 'bullmq-retry-wrong-delay-type',
        delayType: 'queue',
      },
    )
  })
})
