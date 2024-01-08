import BaseError from './base'

interface RetriableErrorParams {
  error: ConstructorParameters<typeof BaseError>[0]
  delayInMs: number | 'default'
}

/**
 * When thrown, this error indicates that we should requeue the action and for
 * retrying. This is passed directly to our BullMQ's backoff strategy callback.
 *
 * Typically used in these 2 places:
 * 1. Explicitly thrown by action code in response to some app-specific event
 *    (e.g. rate limited by M365).
 * 2. Default action error handler (`handleErrorAndThrow`).
 */
export default class RetriableError extends BaseError {
  delayInMs: RetriableErrorParams['delayInMs']

  constructor({ error, delayInMs }: RetriableErrorParams) {
    super(error)
    this.delayInMs = delayInMs
  }
}
