import { extractErrorCode, extractErrorMessage } from '@/helpers/pg-error'

import RetriableError from './retriable-error'

/**
 * Thrown at worker boundaries when a transient Postgres / socket error caused
 * the failure. BullMQ retries the job with capped exponential backoff so a
 * brief DB blip doesn't fail the execution permanently.
 */
export default class TransientDBError extends RetriableError {
  errorCode: string | undefined
  errorMessage: string | undefined

  constructor(originalError: unknown, contextMessage?: string) {
    const errorCode = extractErrorCode(originalError)
    const errorMessage = extractErrorMessage(originalError)

    const prefix = contextMessage
      ? `Transient DB error (${contextMessage})`
      : 'Transient DB error'
    const formatted = `${prefix}: ${errorMessage ?? 'unknown'} (code=${
      errorCode ?? 'unknown'
    })`

    super({
      error: formatted,
      delayInMs: 1000,
      delayType: 'step',
      maxDelayMs: 5000,
    })

    this.errorCode = errorCode
    this.errorMessage = errorMessage
  }
}
