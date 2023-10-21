import { afterEach, describe, expect, it, vi } from 'vitest'

import { exponentialBackoffWithJitter, INITIAL_DELAY_MS } from '../backoff'

describe('Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('backs off exponentially before jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    expect(exponentialBackoffWithJitter(1)).toEqual(INITIAL_DELAY_MS)
    expect(exponentialBackoffWithJitter(2)).toEqual(INITIAL_DELAY_MS * 2)
    expect(exponentialBackoffWithJitter(3)).toEqual(INITIAL_DELAY_MS * 4)
  })

  it('applies jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(exponentialBackoffWithJitter(1)).toEqual(
      Math.round(INITIAL_DELAY_MS / 2),
    )
  })
})
