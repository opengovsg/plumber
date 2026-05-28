/**
 * BullMQ Pro compatibility shim for local development.
 *
 * This file re-exports the free `bullmq` package using the same class/type
 * names as `@taskforcesh/bullmq-pro`, so that the rest of the backend can
 * run without a paid BullMQ Pro licence.
 *
 * Pro-only features (job groups, per-group rate limiting, group status queries)
 * are stubbed out as no-ops. This means:
 * - Group concurrency / rate-limit config is silently ignored.
 * - `rateLimitGroup()` is a no-op (group-delay RetriableErrors fall through to
 *   the normal step-retry path instead).
 * - `getGroupsByStatus()` always returns an empty array.
 *
 * This is intentional: local development does not need production-level
 * throughput shaping, so losing these features is an acceptable trade-off.
 */

import {
  Job,
  type JobsOptions,
  Queue,
  type QueueOptions,
  UnrecoverableError,
  Worker,
  type WorkerOptions,
} from 'bullmq'

// ---------------------------------------------------------------------------
// Pro-specific type extensions
// ---------------------------------------------------------------------------

export interface GroupJobConfig {
  id: string
  limit?: { max: number; duration: number }
}

export interface GroupWorkerConfig {
  concurrency?: number
  limit?: { max: number; duration: number }
}

/** Drop-in for `JobsProOptions` — adds the optional `group` field. */
export type JobsProOptions = JobsOptions & {
  group?: GroupJobConfig
}

/** Drop-in for `QueueProOptions`. */
export type QueueProOptions = QueueOptions

/** Drop-in for `WorkerProOptions` — adds the optional `group` field. */
export type WorkerProOptions = WorkerOptions & {
  group?: GroupWorkerConfig
}

/** Drop-in for `JobPro` — adds Pro-specific fields as optional. */
export type JobPro<T = any, R = any, N extends string = string> = Job<
  T,
  R,
  N
> & {
  /** BullMQ Pro tracks attempts differently; undefined in the free version. */
  attemptsStarted?: number
  opts: Job<T, R, N>['opts'] & {
    group?: GroupJobConfig
  }
}

// ---------------------------------------------------------------------------
// GroupStatus enum stub
// ---------------------------------------------------------------------------

export enum GroupStatus {
  Waiting = 'waiting',
  Paused = 'paused',
  Running = 'running',
}

// ---------------------------------------------------------------------------
// QueuePro — Queue with stub Pro group methods
// ---------------------------------------------------------------------------

export class QueuePro<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
> extends Queue<DataType, ResultType, NameType> {
  /**
   * Pro-only: returns groups filtered by status.
   * Stub always returns an empty array in local dev.
   */
  async getGroupsByStatus(
    _status: GroupStatus,
  ): Promise<Array<{ id: string }>> {
    return []
  }

  /** Pro-only: pauses a job group. No-op in local dev. */
  async pauseGroup(_groupId: string): Promise<boolean> {
    return true
  }

  /** Pro-only: resumes a paused job group. No-op in local dev. */
  async resumeGroup(_groupId: string): Promise<boolean> {
    return true
  }

  /** Pro-only: sets per-group concurrency. No-op in local dev. */
  async setGroupConcurrency(
    _groupId: string,
    _concurrency: number,
  ): Promise<void> {
    // no-op
  }

  /** Pro-only: removes per-group concurrency limit. No-op in local dev. */
  async deleteGroupConcurrency(_groupId: string): Promise<void> {
    // no-op
  }

  /** Pro-only: returns current group concurrency. Returns undefined in local dev. */
  async getGroupConcurrency(_groupId: string): Promise<number | undefined> {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// WorkerPro — Worker with stub Pro group methods
// ---------------------------------------------------------------------------

export class WorkerPro<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
> extends Worker<DataType, ResultType, NameType> {
  /**
   * Pro-only: rate-limits a specific job group.
   * Stub is a no-op in local dev — the job will be retried via the normal
   * step-retry path instead of a group delay.
   */
  rateLimitGroup(_job: Job<DataType>, _delayInMs: number): void {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { UnrecoverableError }
export type { Job as JobProClass }
