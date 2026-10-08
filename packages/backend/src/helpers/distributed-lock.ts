import {
  ExecutionError,
  Redlock,
  ResourceLockedError,
} from '@sesamecare-oss/redlock'
import { type Span } from 'dd-trace'

import { REDIS_DB_INDEX } from '@/config/redis'

import logger from './logger'
import { makeRedisAppDataKey, redisAppDataClient } from './redis-app-data'

//
// Generic per-key distributed lock, a thin adapter over @sesamecare-oss/redlock
// (the maintained TypeScript Redlock fork) on the app-data Redis DB.
//
// The generic execution path (processAction / the batch worker) acquires this
// around an action's run when the app's queue declares a lock key via its
// `getLockKey` hook (see IAppQueue.getLockKey). Today only m365-excel uses it,
// to serialize all WorkbookSession access to a file across the per-app queue,
// the batch queue and test runs — restoring the per-file serialization that
// splitting `createTableRow` onto its own queue would otherwise break.
//
// We run on a SINGLE Redis instance, so the Redlock multi-node quorum collapses
// to the canonical `SET NX PX` + token-safe Lua release/extend that redlock
// implements internally. The library buys us a reviewed, maintained
// implementation of that recipe plus `using()`, which auto-extends the lock on
// a heartbeat and exposes an AbortSignal — so a long operation never expires the
// lock out from under itself, and (unlike a hand-rolled heartbeat) the work is
// signalled to abort if an extension is ever lost rather than continuing under a
// lock we no longer hold.
//

// Lock TTL. With `using()` auto-extension this only bounds how long a lock
// lingers after a worker DIES mid-operation (extension stops -> the key expires
// within one TTL window) — a no-permanent-deadlock bound. It's generous vs the
// m365 per-request timeout (M365_REQUEST_TIMEOUT_MS = 3 min), so a normal single
// operation finishes well within it and auto-extension rarely even fires.
const LOCK_TTL_MS = 60_000

// Short jittered up-front retry to absorb micro-contention before giving up:
// ~3 attempts over ~100-300ms total. Matches the prior hand-rolled retry.
const ACQUIRE_RETRY_COUNT = 2
const ACQUIRE_RETRY_DELAY_MS = 50
const ACQUIRE_RETRY_JITTER_MS = 100

// Begin auto-extending once less than this remains on the TTL.
const AUTOMATIC_EXTENSION_THRESHOLD_MS = 500

// Lock keys live under their own namespace so they never collide with other
// app-data keys (the client sets no keyPrefix).
const LOCK_KEY_NAMESPACE = 'distributed-lock'

function makeLockResourceKey(key: string): string {
  return makeRedisAppDataKey(LOCK_KEY_NAMESPACE, `${key}:lock`)
}

const redlock = new Redlock([redisAppDataClient], {
  // IMPORTANT: redlock runs SELECT <db> inside its Lua scripts and defaults to
  // db 0, so without this the keys would land in the queue DB, not app-data.
  db: REDIS_DB_INDEX.APP_DATA,
  retryCount: ACQUIRE_RETRY_COUNT,
  retryDelay: ACQUIRE_RETRY_DELAY_MS,
  retryJitter: ACQUIRE_RETRY_JITTER_MS,
  automaticExtensionThreshold: AUTOMATIC_EXTENSION_THRESHOLD_MS,
})

// redlock is an EventEmitter that emits 'error' for both background extension
// failures during `using()` AND every failed acquire attempt. Attaching a
// handler keeps an unhandled 'error' from crashing the process. A
// ResourceLockedError just means the key is currently held — ordinary
// contention (handled by withLock's onContention), not a fault — so we drop it
// to avoid flooding error logs under load; only genuinely unexpected errors
// (e.g. Redis connectivity) are surfaced.
redlock.on('error', (err) => {
  if (err instanceof ResourceLockedError) {
    return
  }
  logger.error('Redlock background error', { event: 'redlock-error', err })
})

/**
 * Runs `fn` while holding the distributed lock for `lockKey`, releasing it when
 * `fn` settles. Callers that may have no key (app declares no `getLockKey`)
 * branch themselves: `lockKey ? withLock(lockKey, body, opts) : body()`.
 *
 * While `fn` runs the lock is auto-extended (redlock's `using`), so a slow/long
 * operation never expires the lock out from under itself; on worker death
 * extension stops and the key expires within one TTL window.
 *
 * On contention (the key is still held after the short up-front retry) redlock
 * throws an `ExecutionError`; we route that to `onContention`, which either
 * THROWS (per-app path / test runs — the thrown error becomes the caller's
 * re-queue or user-facing error) OR performs its own re-queue and RETURNS a
 * value (the batch path moves its members to `delayed` and returns). No lock is
 * held on contention, so nothing is released. The generic `lock.wait_ms` /
 * `lock.contended` span tags are emitted here; any path-specific tag (e.g.
 * `lock.requeued`) belongs in `onContention`.
 *
 * IMPORTANT: redlock's `using` also throws `ExecutionError` when the RELEASE in
 * its `finally` fails (Redis blip, or the key already expired / was taken over).
 * That throw would replace `fn`'s result, so we capture `fn`'s outcome inside
 * the routine and only treat an `ExecutionError` as contention when the routine
 * never started. A release failure after `fn` settled is logged and `fn`'s own
 * outcome is returned: the work is already committed, and re-queueing it (the
 * contention path) would duplicate the write. The key expires on its own.
 *
 * Trade-off: redlock's `using` aborts the supplied signal if an auto-extension
 * fails. We don't thread that signal into `run`/`runBatch` today (parity with
 * the previous heartbeat, which also let `fn` finish), so a write could complete
 * under a lock we no longer hold. The window is tiny (extension only fails when
 * Redis is unreachable) and is the same accepted-duplication class noted as a
 * non-goal in the m365 batching plan.
 */
type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  opts: {
    span?: Span | null
    onContention: (lockKey: string) => Promise<T> | T
  },
): Promise<T> {
  const start = Date.now()
  let outcome: Outcome<T> | null = null

  try {
    await redlock.using(
      [makeLockResourceKey(lockKey)],
      LOCK_TTL_MS,
      async () => {
        opts.span?.addTags({
          'lock.wait_ms': Date.now() - start,
          'lock.contended': false,
        })
        try {
          outcome = { ok: true, value: await fn() }
        } catch (error) {
          outcome = { ok: false, error }
        }
      },
    )
  } catch (err) {
    if (outcome === null) {
      // The routine never ran, so this is an acquisition failure. redlock
      // surfaces "could not acquire after the up-front retry" as ExecutionError.
      if (err instanceof ExecutionError) {
        opts.span?.addTags({
          'lock.wait_ms': Date.now() - start,
          'lock.contended': true,
        })
        return opts.onContention(lockKey)
      }
      throw err
    }
    logger.error('Failed to release distributed lock', {
      event: 'lock-release-failed',
      lockKey,
      err,
    })
  }

  // Cast: TS does not track assignments made inside the `using` callback.
  const settled = outcome as Outcome<T> | null
  if (settled === null) {
    throw new Error('withLock: routine did not run')
  }
  if (settled.ok === false) {
    throw settled.error
  }
  return settled.value
}
