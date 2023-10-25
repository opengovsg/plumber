import { afterEach, describe, expect, it, vi } from 'vitest'

import { exponentialBackoffWithJitter, INITIAL_DELAY_MS } from '../backoff'

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('backs off exponentially with jitter disabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)

    expect(exponentialBackoffWithJitter(1)).toEqual(INITIAL_DELAY_MS)
    expect(exponentialBackoffWithJitter(2)).toEqual(INITIAL_DELAY_MS * 2)
    expect(exponentialBackoffWithJitter(3)).toEqual(INITIAL_DELAY_MS * 4)
    expect(exponentialBackoffWithJitter(4)).toEqual(INITIAL_DELAY_MS * 8)
  })

  it('waits the full duration on the 1st retry', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(exponentialBackoffWithJitter(1)).toEqual(INITIAL_DELAY_MS)
  })

  it('applies jitter after 1st attempt (attemptsMade = $attemptsMade)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(exponentialBackoffWithJitter(2)).toEqual(
      INITIAL_DELAY_MS + INITIAL_DELAY_MS / 2,
    )
    expect(exponentialBackoffWithJitter(3)).toEqual(
      INITIAL_DELAY_MS * 2 + INITIAL_DELAY_MS,
    )
  })

  it('will wait at least the full duration of the previous delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(exponentialBackoffWithJitter(2)).toEqual(INITIAL_DELAY_MS)
    expect(exponentialBackoffWithJitter(3)).toEqual(INITIAL_DELAY_MS * 2)
    expect(exponentialBackoffWithJitter(4)).toEqual(INITIAL_DELAY_MS * 4)
    expect(exponentialBackoffWithJitter(5)).toEqual(INITIAL_DELAY_MS * 8)
  })
})
