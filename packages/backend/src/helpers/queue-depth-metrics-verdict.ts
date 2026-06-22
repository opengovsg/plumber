//
// Pure verdict logic for the worker uptime SLI. Kept free of queue/Redis
// imports so it can be unit tested without touching infrastructure.
//

/**
 * Number of jobs that are ready to run AND eligible to be picked up right now
 * (i.e. not held back by throttling). If this is > 0 while nothing is active,
 * the worker is not dequeuing - an outage.
 *
 * - A positive queue-level rate-limit TTL throttles the entire queue, so
 *   nothing is eligible.
 * - Otherwise eligible work = ungrouped waiting jobs + groups whose head job
 *   is ready (`waiting` group status). Rate-limited groups sit in `limited`
 *   and at-concurrency groups in `maxed`, so neither counts as eligible.
 */
export function computeEligibleWaiting(params: {
  rateLimitTtlMs: number
  waitingCount: number
  readyGroupCount: number
}): number {
  const { rateLimitTtlMs, waitingCount, readyGroupCount } = params
  if (rateLimitTtlMs > 0) {
    return 0
  }
  return waitingCount + readyGroupCount
}

/** 1 = worker is dequeuing (or has nothing eligible to do), 0 = outage. */
export function computeDequeuingOk(
  activeCount: number,
  eligibleWaiting: number,
): 0 | 1 {
  return activeCount > 0 || eligibleWaiting === 0 ? 1 : 0
}
