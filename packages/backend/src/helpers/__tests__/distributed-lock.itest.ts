import { describe, expect, it } from 'vitest'

import { withLock } from '../distributed-lock'

//
// Exercises `withLock` against the REAL app-data Redis (testcontainers). Covers
// the contract the per-file m365 lock depends on: mutual exclusion while held,
// the key freed once the operation settles, the null-key bypass, and that a
// genuine operation error propagates (rather than being mistaken for
// contention). The underlying acquire/release/extend/TTL mechanics are
// @sesamecare-oss/redlock's responsibility and are not re-tested here.
//

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('withLock (integration)', () => {
  it('runs fn directly with no lock when the key is null', async () => {
    let ran = false
    const result = await withLock(
      null,
      async () => {
        ran = true
        return 'ran'
      },
      {
        onContention: () => {
          throw new Error('onContention must not fire for a null key')
        },
      },
    )

    expect(ran).toBe(true)
    expect(result).toBe('ran')
  })

  it('serializes same-key work: a contender hits onContention while the key is held, then acquires once freed', async () => {
    const key = 'wl:held'
    const holderAcquired = deferred()
    const releaseHolder = deferred()

    // Holder takes the lock and keeps it until we let go, so the contender's
    // short up-front retry window fully elapses while the lock is held.
    const holder = withLock(
      key,
      async () => {
        holderAcquired.resolve()
        await releaseHolder.promise
        return 'holder-done'
      },
      { onContention: () => 'holder-contended' },
    )

    await holderAcquired.promise

    let contenderFnRan = false
    const contender = await withLock(
      key,
      async () => {
        contenderFnRan = true
        return 'contender-ran'
      },
      { onContention: () => 'contended' },
    )

    // The contender never ran its fn and was routed to onContention.
    expect(contenderFnRan).toBe(false)
    expect(contender).toBe('contended')

    // Let the holder finish; it releases the lock on settle.
    releaseHolder.resolve()
    expect(await holder).toBe('holder-done')

    // The key is now free, so a fresh acquire runs its fn.
    const after = await withLock(key, async () => 'after-ran', {
      onContention: () => 'after-contended',
    })
    expect(after).toBe('after-ran')
  })

  it('propagates a genuine fn error (not treated as contention) and releases the lock', async () => {
    const key = 'wl:error'

    await expect(
      withLock(
        key,
        async () => {
          throw new Error('boom')
        },
        {
          onContention: () => {
            throw new Error('a fn error must not be routed to onContention')
          },
        },
      ),
    ).rejects.toThrow('boom')

    // The lock was released despite the throw, so the key is acquirable again.
    const after = await withLock(key, async () => 'recovered', {
      onContention: () => 'contended',
    })
    expect(after).toBe('recovered')
  })
})
