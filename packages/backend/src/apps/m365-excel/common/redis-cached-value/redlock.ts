import Redlock, { ResourceLockedError } from 'redlock'

import RetriableError from '@/errors/retriable-error'
import { redisAppDataClient } from '@/helpers/redis-app-data'

// A generic write lock for our data stored in redis APP_DATA DB.
//
// Note that it allows for retrying a little bit, instead of failing
// immediately if it fails to acquire the lock. Although retries will increase
// our worker latency, it reduces full action re-queues (since the default is to
// throw a retry-step error), and also makes front-end UX better (retry-step
// errors surface as real errors in the pipe editor, instead of being retried).
//
// Delay is set to 1 second as (from personal experience), p90 of Graph API
// requests take that long. Plus, having to make requests _within_ a lock should
// be quite rare, so we _should_ be OK to take the occasional worker latency hit.
const redlock = new Redlock([redisAppDataClient], {
  retryCount: 2,
  retryDelay: 1000,
  retryJitter: 100,
})

// Redlock has a timeout to guard against lock holder crashes.
//
// This timeout is arbitrarily set to 150s - a little bit more default timeout
// for 1 HTTP request. The idea is that a lock holder should release the lock if
// its HTTP request has failed; otherwise, it should be able to extend the lock
// before continuing.
const DEAD_LOCK_HOLDER_PREVENTION_TIMEOUT_MS = 150 * 1000

// This is the delay to retry if a worker is unable to acquire a lock (e.g. due
// to some other worker acquiring it and starting a new workbook session).
//
// I chose 5 seconds as that seems to be a reasonable-ish value where p99 (from
// personal experience...) of Graph API requests will complete.
const LOCK_FAILURE_RETRY_DELAY_MS = 5 * 1000

export async function runWithLockElseRetryStep<T>(
  lockKey: string,
  callback: Parameters<typeof redlock.using<T>>[2],
): Promise<T> {
  try {
    return await redlock.using(
      [lockKey],
      DEAD_LOCK_HOLDER_PREVENTION_TIMEOUT_MS,
      callback,
    )
  } catch (error) {
    if (!(error instanceof ResourceLockedError)) {
      throw error
    }

    throw new RetriableError({
      error: 'Unable to acquire redis lock.',
      delayInMs: LOCK_FAILURE_RETRY_DELAY_MS,
    })
  }
}
