import BaseError from './base'

/**
 * Thrown when a per-resource distributed lock (see
 * `helpers/distributed-lock.ts`; the m365 key derivation is in
 * `apps/m365-excel/common/file-lock.ts`) could not be acquired after the short
 * up-front retry — i.e. another worker or test run currently holds the lock for
 * this resource (an m365 file).
 *
 * It is raised by the generic single-job execution path (`processAction`)
 * BEFORE any execution step is recorded, so contention never writes a spurious
 * `'failure'` step. The batch worker never throws this error: it handles
 * contention entirely inside `withLock`'s `onContention` callback instead (see
 * make-action-batch-worker.ts).
 *
 * - On the worker path it is caught by the action worker(s) and translated into
 *   a group rate-limit re-queue (no attempt consumed) rather than a failed step.
 * - On the test-run path the caller surfaces a user-facing `StepError` instead.
 */
export default class FileLockContentionError extends BaseError {
  lockKey: string

  constructor(lockKey: string) {
    super(`Could not acquire file lock: ${lockKey}`)
    this.lockKey = lockKey
    this.name = this.constructor.name
  }
}
