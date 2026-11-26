import { scryptSync } from 'crypto'

import { describe, expect, it, vi } from 'vitest'

import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'

type ScryptCallback = (err: Error | null, key?: Buffer) => void

const mocks = vi.hoisted(() => ({
  scrypt: vi.fn(),
  actualScrypt: null as unknown as typeof import('crypto').scrypt,
}))

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  mocks.actualScrypt = actual.scrypt
  mocks.scrypt.mockImplementation(actual.scrypt)
  return { ...actual, scrypt: mocks.scrypt }
})

import { hashWithScrypt, MAX_QUEUED_HASHES } from '../scrypt'

const nextTick = () => new Promise((resolve) => setImmediate(resolve))

describe('hashWithScrypt', () => {
  it('returns the same bytes as scryptSync, so stored hashes stay valid', async () => {
    const hash = await hashWithScrypt('ABC234', 'user@agency.gov.sg', 64)

    expect(hash.equals(scryptSync('ABC234', 'user@agency.gov.sg', 64))).toBe(
      true,
    )
  })

  it('runs at most 2 hashes at once', async () => {
    const pending: ScryptCallback[] = []
    mocks.scrypt.mockImplementation(
      (_secret: string, _salt: string, _keylen: number, cb: ScryptCallback) => {
        pending.push(cb)
      },
    )
    const calls = Array.from({ length: 5 }, () =>
      hashWithScrypt('ABC234', 'user@agency.gov.sg', 64),
    )

    try {
      await nextTick()
      expect(pending).toHaveLength(2)

      // A failed hash must still free its slot for the next one.
      pending.shift()?.(new Error('scrypt failed'))
      await expect(calls[0]).rejects.toThrow('scrypt failed')
      await nextTick()
      expect(pending).toHaveLength(2)
    } finally {
      while (pending.length > 0) {
        pending.shift()?.(null, Buffer.alloc(64))
        await nextTick()
      }
      await Promise.allSettled(calls)
      mocks.scrypt.mockImplementation(mocks.actualScrypt)
    }

    await expect(Promise.all(calls.slice(1))).resolves.toHaveLength(4)
  })

  it('rejects once the queue is full, then accepts again after it drains', async () => {
    const pending: ScryptCallback[] = []
    mocks.scrypt.mockImplementation(
      (_secret: string, _salt: string, _keylen: number, cb: ScryptCallback) => {
        pending.push(cb)
      },
    )
    const calls = Array.from({ length: 2 + MAX_QUEUED_HASHES }, () =>
      hashWithScrypt('ABC234', 'user@agency.gov.sg', 64),
    )
    const overflow = hashWithScrypt('ABC234', 'user@agency.gov.sg', 64)
    const settled = Promise.allSettled([...calls, overflow])

    let results: PromiseSettledResult<Buffer>[]
    try {
      // Drains every submitted call, so a cap that admits the overflow fails an
      // assertion below instead of timing out.
      for (let i = 0; i <= calls.length; i++) {
        await nextTick()
        pending.shift()?.(null, Buffer.alloc(64))
      }
      results = await settled
    } finally {
      mocks.scrypt.mockImplementation(mocks.actualScrypt)
    }

    expect(results.slice(0, -1).map((r) => r.status)).toEqual(
      calls.map(() => 'fulfilled'),
    )
    expect(results[results.length - 1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(RateLimitedError),
    })
    await expect(
      hashWithScrypt('ABC234', 'user@agency.gov.sg', 64),
    ).resolves.toBeInstanceOf(Buffer)
  })
})
