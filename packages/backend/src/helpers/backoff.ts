import { type WorkerProOptions } from '@taskforcesh/bullmq-pro'

import RetriableError, { DEFAULT_DELAY_MS } from '@/errors/retriable-error'

import logger from './logger'

type BackoffStrategy = WorkerProOptions['settings']['backoffStrategy']
export const exponentialBackoffWithJitter: BackoffStrategy = function (
  attemptsMade,
  _type,
  err,
  _job,
): number {
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
  return prevFullDelay + Math.round(Math.random() * prevFullDelay)
}
