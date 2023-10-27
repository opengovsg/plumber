import { afterEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'

import { exponentialBackoffWithJitter, INITIAL_DELAY_MS } from '../backoff'

vi.mock('@/helpers/logger', () => ({
  default: {
    error: vi.fn(),
  },
}))

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  //
  // TODO: MORE TESTS AFTER PR
  //

  it('applies jitter for errors without a specified delay', () => {
    const err = new RetriableError({ error: 'test error', delay: null })
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(exponentialBackoffWithJitter(1, null, err)).toEqual(
      INITIAL_DELAY_MS + INITIAL_DELAY_MS / 2,
    )
    expect(exponentialBackoffWithJitter(2, null, err)).toEqual(
      INITIAL_DELAY_MS * 2 /* Full delay for 1st retry */ +
        INITIAL_DELAY_MS /* 50% of full delay*/,
    )
    expect(exponentialBackoffWithJitter(3, null, err)).toEqual(
      INITIAL_DELAY_MS * 4 /* Full delay for 2nd retry */ +
        INITIAL_DELAY_MS * 2 /* 50% of full delay*/,
    )
  })

  it('will wait at least the full duration of the previous default delay', () => {
    const err = new RetriableError({ error: 'test error', delay: null })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitter(1, null, err)).toEqual(INITIAL_DELAY_MS)
    expect(exponentialBackoffWithJitter(2, null, err)).toEqual(
      INITIAL_DELAY_MS * 2,
    )
    expect(exponentialBackoffWithJitter(3, null, err)).toEqual(
      INITIAL_DELAY_MS * 4,
    )
    expect(exponentialBackoffWithJitter(4, null, err)).toEqual(
      INITIAL_DELAY_MS * 8,
    )
  })

  it('makes  the base delay if specified ')
})
