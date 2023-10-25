import { afterEach, describe, expect, it, vi } from 'vitest'

import { exponentialBackoffWithJitter, INITIAL_DELAY_MS } from '../backoff'

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('backs off exponentially with jitter disabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)

    expect(exponentialBackoffWithJitter(1)).toEqual(INITIAL_DELAY_MS * 2)
    expect(exponentialBackoffWithJitter(2)).toEqual(INITIAL_DELAY_MS * 4)
    expect(exponentialBackoffWithJitter(3)).toEqual(INITIAL_DELAY_MS * 8)
    expect(exponentialBackoffWithJitter(4)).toEqual(INITIAL_DELAY_MS * 16)
  })

  it('applies jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(exponentialBackoffWithJitter(1)).toEqual(
      INITIAL_DELAY_MS + INITIAL_DELAY_MS / 2,
    )
    expect(exponentialBackoffWithJitter(2)).toEqual(
      INITIAL_DELAY_MS * 2 /* Full delay for 1st retry */ +
        INITIAL_DELAY_MS /* 50% of full delay*/,
    )
    expect(exponentialBackoffWithJitter(3)).toEqual(
      INITIAL_DELAY_MS * 4 /* Full delay for 2nd retry */ +
        INITIAL_DELAY_MS * 2 /* 50% of full delay*/,
    )
  })

  it('will wait at least the full duration of the previous delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitter(1)).toEqual(INITIAL_DELAY_MS)
    expect(exponentialBackoffWithJitter(2)).toEqual(INITIAL_DELAY_MS * 2)
    expect(exponentialBackoffWithJitter(3)).toEqual(INITIAL_DELAY_MS * 4)
    expect(exponentialBackoffWithJitter(4)).toEqual(INITIAL_DELAY_MS * 8)
  })
})
