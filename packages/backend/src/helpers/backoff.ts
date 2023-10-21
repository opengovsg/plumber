import { type BackoffStrategy, type Job } from 'bullmq'

export const INITIAL_DELAY_MS = 5000

export const exponentialBackoffWithJitter: BackoffStrategy = function (
  attemptsMade: number,
  _type: string,
  _err: Error,
  _job: Job,
): number {
  // This implements (uncapped) FullJitter; we want to minimize outgoing calls
  // to be a nice API consumer. Capping should not matter here since we cap
  // total attempts.
  //
  // Reference:
  // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

  const baseDelay = Math.round(Math.pow(2, attemptsMade - 1) * INITIAL_DELAY_MS)
  return Math.round(Math.random() * baseDelay)
}
