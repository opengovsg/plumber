import type { IActionJobData } from '@plumber/types'

import { type JobPro, WorkerPro } from '@taskforcesh/bullmq-pro'

// Re-queue delay range when a job loses the per-file lock race. Jittered so a
// herd of contenders on the same file doesn't retry in lockstep.
const REQUEUE_MIN_DELAY_MS = 250
const REQUEUE_MAX_DELAY_MS = 1000

/**
 * A jittered re-queue delay (ms) for a job that lost the per-file lock race.
 * Shared by both contention paths: the single-job `rateLimitGroup` re-queue
 * below and the batch worker's `moveToDelayed` re-queue (see
 * make-action-batch-worker.ts), so the delay policy lives in one place.
 */
export function fileLockRequeueDelayMs(): number {
  return (
    REQUEUE_MIN_DELAY_MS +
    Math.floor(Math.random() * (REQUEUE_MAX_DELAY_MS - REQUEUE_MIN_DELAY_MS))
  )
}

/**
 * Handles per-file lock contention on the per-app action worker path: re-queues
 * the job onto its group with a short jittered delay and throws `RateLimitError`.
 *
 * bullmq-pro treats `RateLimitError` as "not processed", so NO attempt is
 * consumed and NO failed execution step is written. The lock holder always
 * completes and releases (its TTL covers worker death), so the contender always
 * eventually makes progress — worst case is added latency, never a live-lock.
 *
 * The per-app action queue groups its jobs by file, so `rateLimitGroup` always
 * has a group id to pause. The batch worker can't use this path (its synthetic
 * container job carries no group id) and re-queues the whole batch via a thrown
 * RetriableError instead — see make-action-batch-worker.ts.
 */
export function requeueOnFileLockContention(
  worker: WorkerPro<IActionJobData>,
  job: JobPro<IActionJobData>,
): never {
  worker.rateLimitGroup(job, fileLockRequeueDelayMs())
  throw WorkerPro.RateLimitError()
}
