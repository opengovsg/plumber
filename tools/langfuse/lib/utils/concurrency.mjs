import { MAX_AHEAD_PER_WORKER } from '../constants.mjs'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs fetches in parallel but hands results to `onResult` in input order.
 *
 * Keeps output sorted by timestamp without holding every trace in memory.
 */
export async function fetchInOrder(items, concurrency, fetchOne, onResult) {
  const pending = new Map()
  const maxAhead = concurrency * MAX_AHEAD_PER_WORKER
  let waiters = []
  let nextToFetch = 0
  let nextToEmit = 0
  // IMPORTANT: only one drain may run at a time, or writes from two workers interleave.
  let draining = false

  async function drain() {
    if (draining) {
      return
    }
    draining = true
    try {
      while (pending.has(nextToEmit)) {
        const result = pending.get(nextToEmit)
        pending.delete(nextToEmit)
        nextToEmit++
        await onResult(result)
        const woken = waiters
        waiters = []
        woken.forEach((wake) => wake())
      }
    } finally {
      draining = false
    }
  }

  async function worker() {
    while (nextToFetch < items.length) {
      while (nextToFetch - nextToEmit >= maxAhead) {
        await new Promise((resolve) => waiters.push(resolve))
      }
      // Other workers may have claimed the last item while this one waited.
      if (nextToFetch >= items.length) {
        break
      }
      const index = nextToFetch++
      pending.set(index, await fetchOne(items[index]))
      await drain()
    }
    await drain()
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  )
}
