import { describe, expect, it } from 'vitest'

import {
  computeDequeuingOk,
  computeEligibleWaiting,
} from '../queue-depth-metrics-verdict'

describe('computeEligibleWaiting', () => {
  it('counts ungrouped waiting jobs when not throttled', () => {
    expect(
      computeEligibleWaiting({
        rateLimitTtlMs: -1,
        waitingCount: 5,
        readyGroupCount: 0,
      }),
    ).toBe(5)
  })

  it('counts ready groups on top of ungrouped waiting jobs', () => {
    expect(
      computeEligibleWaiting({
        rateLimitTtlMs: -1,
        waitingCount: 2,
        readyGroupCount: 3,
      }),
    ).toBe(5)
  })

  it('returns 0 when the queue is throttled by a queue-level rate limit', () => {
    expect(
      computeEligibleWaiting({
        rateLimitTtlMs: 1000,
        waitingCount: 10,
        readyGroupCount: 4,
      }),
    ).toBe(0)
  })

  it('returns 0 when nothing is waiting', () => {
    expect(
      computeEligibleWaiting({
        rateLimitTtlMs: -1,
        waitingCount: 0,
        readyGroupCount: 0,
      }),
    ).toBe(0)
  })
})

describe('computeDequeuingOk', () => {
  it('is healthy when jobs are actively processing', () => {
    expect(computeDequeuingOk(3, 10)).toBe(1)
  })

  it('is healthy when there is no eligible work to pick up', () => {
    expect(computeDequeuingOk(0, 0)).toBe(1)
  })

  it('is an outage when eligible work exists but nothing is active', () => {
    expect(computeDequeuingOk(0, 4)).toBe(0)
  })

  it('treats a throttled queue (no eligible work) as healthy even when idle', () => {
    // e.g. rate-limited queue: eligibleWaiting collapses to 0, active is 0.
    expect(computeDequeuingOk(0, 0)).toBe(1)
  })
})
