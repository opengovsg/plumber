import { type M365TenantInfo } from '@/config/app-env-vars/m365'
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
