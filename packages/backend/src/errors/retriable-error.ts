import BaseError from './base'

interface RetriableErrorParams {
  error: ConstructorParameters<typeof BaseError>[0]
  delayInMs: number | 'default'
}

/**
 * Throw this in a worker action body to get BullMQ to retry.
 */
export default class RetriableError extends BaseError {
  delayInMs: RetriableErrorParams['delayInMs']

  constructor({ error, delayInMs }: RetriableErrorParams) {
    super(error)
    this.delayInMs = delayInMs
  }
}
