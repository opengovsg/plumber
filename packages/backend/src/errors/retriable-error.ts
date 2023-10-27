import BaseError from './base'

interface RetriableErrorParams {
  error: ConstructorParameters<typeof BaseError>[0]
  delay: number | 'default'
}

/**
 * Throw this in a worker action body to get BullMQ to retry.
 */
export default class RetriableError extends BaseError {
  delay: RetriableErrorParams['delay']

  constructor({ error, delay }: RetriableErrorParams) {
    super(error)
    this.delay = delay
  }
}
