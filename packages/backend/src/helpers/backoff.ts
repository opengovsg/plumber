import { type BackoffStrategy, type Job } from 'bullmq'

import RetriableError from '@/errors/retriable-error'

import logger from './logger'

export const INITIAL_DELAY_MS = 3000

function computeInitialDelay(err: Error): number {
  if (!(err instanceof RetriableError)) {
    logger.error('Triggered BullMQ retry without RetriableError', {
      event: 'bullmq-retry-without-retriable-error',
    })
    return INITIAL_DELAY_MS
  }

  return err.delayInMs === 'default'
    ? INITIAL_DELAY_MS
    : // Take max to prevent stuff like 10ms delay causing effectively zero
      // backoff.
      Math.max(INITIAL_DELAY_MS, err.delayInMs)
}

export const exponentialBackoffWithJitter: BackoffStrategy = function (
  attemptsMade: number,
  _type: string,
  err: Error,
  job: Job,
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

  const initialDelay = computeInitialDelay(err)

  const prevFullDelay = Math.pow(2, attemptsMade - 1) * initialDelay
  const totalDelay = prevFullDelay + Math.round(Math.random() * prevFullDelay)
  logger.info('Job delay calculation', {
    flowId: job?.data?.flowId,
    executionId: job?.data?.executionId,
    stepId: job?.data?.stepId,
    attemptsMade,
    delay: totalDelay,
  })
  return totalDelay
}
