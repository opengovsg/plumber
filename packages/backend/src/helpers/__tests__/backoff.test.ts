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

  it('caps the jittered delay at maxDelayMs when set', () => {
    const err = new RetriableError({
      error: 'test error',
      delayInMs: 1000,
      delayType: 'step',
      maxDelayMs: 5000,
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    // Attempt 1: prevFullDelay = 1000, jittered = 1500 → uncapped.
    expect(exponentialBackoffWithJitter(1, null, err)).toEqual(1500)
    // Attempt 2: prevFullDelay = 2000, jittered = 3000 → uncapped.
    expect(exponentialBackoffWithJitter(2, null, err)).toEqual(3000)
    // Attempt 3: prevFullDelay = 4000, jittered = 6000 → capped at 5000.
    expect(exponentialBackoffWithJitter(3, null, err)).toEqual(5000)
    // Attempt 4: prevFullDelay = 8000, jittered = 12000 → capped at 5000.
    expect(exponentialBackoffWithJitter(4, null, err)).toEqual(5000)
  })

  it('does not cap the delay when maxDelayMs is omitted', () => {
    const err = new RetriableError({
      error: 'test error',
      delayInMs: 1000,
      delayType: 'step',
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(exponentialBackoffWithJitter(10, null, err)).toEqual(
      Math.pow(2, 9) * 1000 + Math.pow(2, 9) * 500,
    )
  })

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
