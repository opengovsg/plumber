import Redlock, { ResourceLockedError } from 'redlock'

import { type M365TenantInfo } from '@/config/app-env-vars/m365'
import RetriableError from '@/errors/retriable-error'
import {
  makeRedisAppDataKey,
  redisAppDataClient,
} from '@/helpers/redis-app-data'

import { APP_KEY } from '../constants'

//
// In general, we store file-specific data in our app data redis DB, with keys
// following the naming convention below:
//
// <M365 Tenant ID>:<File ID>:<...description of data>
//
// This function helps to make sure our redis operations keep to this key naming
// convention.
//
function makeRedisKeyPrefix(tenant: M365TenantInfo, fileId: string): string {
  return makeRedisAppDataKey(APP_KEY, `${tenant.id}:${fileId}:`)
}

//
// Locking stuff
//

// This is the lock used as a write lock for session IDs
//
// Note that it allows for retrying a little bit, instead of failing
// immediately if it fails to acquire the lock. Although retries will increase
// our worker latency, it reduces full action re-queues (since the default is to
// throw a retry-step error), and also makes front-end UX better (retry-step
// errors surface as real errors in the pipe editor, instead of being retried).
//
// Session manipulation should be pretty fast plus this should be quite rare, so
// we _should_ be OK to take the occasional latency hit.
const redlock = new Redlock([redisAppDataClient], {
  retryCount: 2,
  retryDelay: 500,
  retryJitter: 100,
})

// Redlock has a timeout to guard against lock holder crashes.
//
// This timeout is arbitrarily set to 150s - a little bit more default timeout
// for 1 HTTP request. The idea is that a lock holder should release the lock if
// its HTTP request has failed; otherwise, it should be able to extend the lock
// before continuing.
const DEAD_LOCK_HOLDER_PREVENTION_TIMEOUT_MS = 150 * 1000

// This is the delay to retry if a worker is unable to acquire a lock (e.g. due
// to some other worker acquiring it and starting a new workbook session).
//
// I chose 5 seconds as that seems to be a reasonable-ish value where p90 (from
// personal experience...) of Graph API requests will complete.
const LOCK_FAILURE_RETRY_DELAY_MS = 5 * 1000

export async function runWithLockElseRetryStep<T>(
  tenant: M365TenantInfo,
  fileId: string,
  callback: Parameters<typeof redlock.using<T>>[2],
): Promise<T> {
  const lockKey = `${makeRedisKeyPrefix(tenant, fileId)}session:lock`

  try {
    return await redlock.using(
      [lockKey],
      DEAD_LOCK_HOLDER_PREVENTION_TIMEOUT_MS,
      callback,
    )
  } catch (error) {
    if (!(error instanceof ResourceLockedError)) {
      throw error
    }

    throw new RetriableError({
      error: 'Unable to acquire excel session lock.',
      delayInMs: LOCK_FAILURE_RETRY_DELAY_MS,
    })
  }
}

//
// Session management stuff
//

// Session ID redis key expiry
//
// Set to 5 minutes as per Microsoft's docs. See giant comment in index.ts for
// more details.
const SESSION_ID_EXPIRY_SECONDS = 5 * 60

export async function getSessionIdFromRedis(
  tenant: M365TenantInfo,
  fileId: string,
): Promise<string | null> {
  const key = `${makeRedisKeyPrefix(tenant, fileId)}session:id`

  const [[getErr, sessionId], [expireErr]] = await redisAppDataClient
    .multi()
    .get(key)
    .expire(key, SESSION_ID_EXPIRY_SECONDS)
    .exec()

  if (getErr) {
    throw getErr
  }
  if (expireErr) {
    throw expireErr
  }

  return sessionId as string | null
}

export async function setSessionIdInRedis(
  tenant: M365TenantInfo,
  fileId: string,
  sessionId: string,
): Promise<void> {
  const key = `${makeRedisKeyPrefix(tenant, fileId)}session:id`
  await redisAppDataClient.set(key, sessionId, 'EX', SESSION_ID_EXPIRY_SECONDS)
}

export async function clearSessionIdFromRedis(
  tenant: M365TenantInfo,
  fileId: string,
): Promise<void> {
  await redisAppDataClient.del(
    `${makeRedisKeyPrefix(tenant, fileId)}session:id`,
  )
}
