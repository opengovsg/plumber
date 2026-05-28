import { UnrecoverableError } from '@taskforcesh/bullmq-pro'

import TransientDBError from '@/errors/transient-db-error'

import { MAX_TRANSIENT_DB_ATTEMPTS } from './default-job-configuration'
import logger from './logger'
import {
  extractErrorCode,
  extractErrorMessages,
  isUniqueViolation,
} from './pg-error'

const TRANSIENT_MESSAGE_SUBSTRINGS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'Connection terminated',
]

/**
 * True for transient Postgres / socket errors that we expect to clear up on a
 * retry. False for unique-violation (`23505`), which represents a successful
 * prior insert that committed — the recovery path there is the in-transaction
 * `forUpdate()` existence check, not retry.
 */
export function isTransientDbError(err: unknown): boolean {
  if (err === null || err === undefined) {
    return false
  }

  if (isUniqueViolation(err)) {
    return false
  }

  const code = extractErrorCode(err)
  if (code && (code.startsWith('08') || code.startsWith('57P0'))) {
    return true
  }

  const messages = extractErrorMessages(err)
  for (const message of messages) {
    for (const substring of TRANSIENT_MESSAGE_SUBSTRINGS) {
      if (message.includes(substring)) {
        return true
      }
    }
  }

  return false
}

interface ThrowAsTransientOptions {
  attemptsStarted: number
  context?: string
}

/**
 * Called from worker catch blocks. If the error is a transient DB error and
 * the transient-DB attempts budget isn't exhausted, throws a `TransientDBError`
 * so BullMQ retries the job. If the budget is exhausted, throws an
 * `UnrecoverableError` to fail the job fast rather than chewing through the
 * broader `MAXIMUM_JOB_ATTEMPTS` budget. Otherwise rethrows the original error
 * unchanged so existing catch logic can handle it.
 */
export function throwAsTransientIfDbTransient(
  err: unknown,
  { attemptsStarted, context }: ThrowAsTransientOptions,
): void {
  if (!isTransientDbError(err)) {
    throw err
  }

  if (attemptsStarted < MAX_TRANSIENT_DB_ATTEMPTS) {
    throw new TransientDBError(err, context)
  }

  logger.error('Transient DB retry budget exhausted', {
    event: 'transient-db-retry-exhausted',
    attemptsStarted,
    context,
    errorCode: extractErrorCode(err),
  })

  throw new UnrecoverableError(
    `Transient DB retry budget exhausted: ${JSON.stringify({
      context,
      errorCode: extractErrorCode(err),
      attemptsStarted,
    })}`,
  )
}

function jitteredDelay(attempt: number): number {
  const base = 1000 * Math.pow(2, attempt)
  const jitter = Math.random() * base * 0.5
  return Math.min(base + jitter, 5000)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * For HTTP-edge call sites (webhook handler, partial-retry mutation) where
 * there's no BullMQ to fall back on. Retries the function up to
 * `MAX_TRANSIENT_DB_ATTEMPTS` times on transient DB errors. Rethrows on
 * non-transient errors and on the final attempt.
 */
export async function retryOnTransientDbError<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      const isLastAttempt = attempt >= MAX_TRANSIENT_DB_ATTEMPTS - 1
      if (!isTransientDbError(err) || isLastAttempt) {
        throw err
      }
      const delay = jitteredDelay(attempt)
      logger.info('Retrying after transient DB error', {
        event: 'db-retry',
        context,
        attempt,
        delay,
        errorCode: extractErrorCode(err),
      })
      await sleep(delay)
    }
  }
}
