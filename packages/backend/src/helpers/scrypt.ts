import { scrypt } from 'crypto'
import { promisify } from 'util'

import pLimit from 'p-limit'

import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>

// Leaves the other libuv threadpool threads free for DNS lookups and zlib
// during a flood of unauthenticated OTP or tile password requests.
const MAX_CONCURRENT_HASHES = 2
// Bounds how many requests wait for a hash, so a flood holds limited memory
// and each wait stays short.
// Exported so that tests can fill the queue without restating the number.
export const MAX_QUEUED_HASHES = 20

const limit = pLimit(MAX_CONCURRENT_HASHES)

/**
 * IMPORTANT: this rejects with RateLimitedError when the queue is full. Call it
 * before charging an OTP or password attempt, so a rejection spends none.
 */
export async function hashWithScrypt(
  secret: string,
  salt: string,
  keylen: number,
): Promise<Buffer> {
  // p-limit counts a call as pending until a later microtask starts it, so cap
  // the total rather than pendingCount alone.
  if (
    limit.activeCount + limit.pendingCount >=
    MAX_CONCURRENT_HASHES + MAX_QUEUED_HASHES
  ) {
    throw new RateLimitedError('Too many requests. Please try again shortly.')
  }
  return limit(() => scryptAsync(secret, salt, keylen))
}
