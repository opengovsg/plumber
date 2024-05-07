import BaseError from './base'

export const DEFAULT_DELAY_MS = 3000

interface RetriableErrorParams {
  error: ConstructorParameters<typeof BaseError>[0]
  delayInMs: number | 'default'
  delayType: 'step' | 'group' | 'queue'
}

/**
 * When thrown, this error indicates that we should retry the step that threw
 * this. Note that we always apply a delay before trying.
 *
 * The `delayType` param allows for configuring how we should delay before
 * retrying:
 * - `queue`: The step is re-queued, and the ENTIRE queue is delayed until the
 *            delay period is over. This is generally used in per-app queues
 *            (e.g. the app requires us to pause all API calls if they return a
 *            429). This will not work if the step came from the default action
 *            queue.
 * - `group`: The step is re-queued, and the group associated with the step is
 *            delayed until the delay period is over. Generally used in per-app
 *            queues (e.g. the app rate limits by connection ID, and the group
 *            ID is set to the connection ID).
 * - `step`: The step is re-queued with delay set to the delay period. The other
 *           steps in the queue and group will continue to be processed as
 *           normal.
 *
 * This error is typically thrown in these 2 places:
 * 1. Explicitly thrown by action code in response to some app-specific event
 *    (e.g. rate limited by M365).
 * 2. Default action error handler (`handleFailedStepAndThrow`).
 */
export default class RetriableError extends BaseError {
  delayInMs: number
  delayType: RetriableErrorParams['delayType']

  constructor({ error, delayInMs, delayType }: RetriableErrorParams) {
    super(error)

    this.delayInMs = delayInMs === 'default' ? DEFAULT_DELAY_MS : delayInMs
    this.delayType = delayType
  }
}
