import BaseError from './base'

/**
 * Thrown by `processAction` before any execution step is recorded. The action
 * worker re-queues the job after `delayMs` without using an attempt.
 */
export default class RequeueWithoutAttemptError extends BaseError {
  delayMs: number

  constructor(delayMs: number) {
    super(`Re-queue without attempt after ${delayMs}ms`)
    this.delayMs = delayMs
    this.name = this.constructor.name
  }
}
