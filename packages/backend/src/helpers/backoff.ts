import { type WorkerProOptions } from '@taskforcesh/bullmq-pro'

import RetriableError, { DEFAULT_DELAY_MS } from '@/errors/retriable-error'

import logger from './logger'

type BackoffStrategy = WorkerProOptions['settings']['backoffStrategy']
export const exponentialBackoffWithJitter: BackoffStrategy = async function (
  attemptsMade,
  _type,
  err,
  job,
): Promise<number> {
  // This implements FullJitter-like jitter, with the following changes:
  //
  // * We wait _at least_ the full duration of the previous delay (or on the 1st
  //   retry, at least the full initial delay).
  // * No cap on wait time; capping should not matter here since we cap total
  //   attempts.
  //
  // Reference:
  // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

  // Sanity checks first...
  if (!(err instanceof RetriableError)) {
    logger.error('Triggered BullMQ retry without RetriableError', {
      event: 'bullmq-retry-without-retriable-error',
    })
  } else if (err.delayType !== 'step') {
    logger.error(
      'Triggered BullMQ retry with RetriableError of the wrong delay type',
      {
        event: 'bullmq-retry-wrong-delay-type',
        delayType: err.delayType,
      },
    )
  }

  const initialDelay =
    err instanceof RetriableError ? err.delayInMs : DEFAULT_DELAY_MS
  const prevFullDelay = Math.pow(2, attemptsMade - 1) * initialDelay
  const delay = prevFullDelay + Math.round(Math.random() * prevFullDelay)

  if (job) {
    try {
      // The job doesn't actually become eligible to run until `delay` ms from
      // now - moveToFailed() computes the delayed job's eligibility score as
      // Date.now() + delay right after this strategy returns (see
      // node_modules/bullmq/dist/cjs/classes/job.js:428). Stamping now() alone
      // would count the entire backoff wait as time in queue, even though
      // it's an intentional wait, not queue congestion (same reasoning as
      // why job.opts.delay is excluded for a job's first attempt).
      await job.updateData({
        ...job.data,
        retryTimestamp: Date.now() + delay,
      })
    } catch (updateErr) {
      // Never let a telemetry-stamp failure break the actual retry - this
      // await sits directly in BullMQ's moveToFailed() path, so a rejection
      // here would abort the retry scheduling itself.
      logger.error('Failed to stamp retryTimestamp for automatic retry', {
        event: 'backoff-stamp-retry-timestamp-failed',
        err: updateErr,
      })
    }
  }

  return delay
}
