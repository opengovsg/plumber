import { type BackoffStrategy, type Job } from 'bullmq'

export const INITIAL_DELAY_MS = 5000

export const exponentialBackoffWithJitter: BackoffStrategy = function (
  attemptsMade: number,
  _type: string,
  _err: Error,
  _job: Job,
): number {
  // This implements FullJitter-like jitter, with the following changes:
  //
  // * We wait the full delay on the 1st retry.
  // * We wait at least the full duration of the previous delay.
  // * No cap on wait time; capping should not matter here since we cap total
  //   attempts.
  //
  // Reference:
  // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

  if (attemptsMade === 1) {
    return INITIAL_DELAY_MS
  }

  const prevFullDelay = Math.pow(2, attemptsMade - 2) * INITIAL_DELAY_MS
  return prevFullDelay + Math.round(Math.random() * prevFullDelay)
}
