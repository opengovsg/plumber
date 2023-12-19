/**
 * We cache data in the APP_DATA redis DB, with keys following the naming
 * convention below:
 *
 * m365-excel:<M365 Tenant ID>:<File / Folder / Object ID>:<A Descriptive Key>
 *
 * The descriptive key can be any valid redis key string; it may even follow the
 * same naming convention!
 *
 * For example:
 * - `m365-excel:abcd-1234:wxyz-0001:excel:session-id`
 *   ===
 *   This contains the excel session ID for an excel file with an ID of
 *   `wxyz-0001` on the M365 tenant whose ID is `abcd-1234`.
 *
 * - `m365-excel:cdef-2345:wxyz-1111:files-list`
 *   ===
 *   This contains a list of files stored in the folder whose ID is `wxyz-1111`,
 *   on the M365 tenant whose ID is `abcd-1234`.
 *
 * - `m365-excel:cdef-2345:wxyz-1111:excel:table:t-001:columns`
 *   ===
 *   This contains a list of columns in the excel table with id `t-001`, for
 *   the excel file with id `wxyz-1111` in the M365 tenant with id `cdef-2345`.
 *   This is an example of a descriptive key which re-uses the name naming
 *   convention; the actual function call used to generate this key is:
 *
 *     makeRedisKey(
 *        tenantInfo, // tenantInfo for tenant ID `cdef-2345`
 *        'wxyz-1111',
 *        'excel:table:t-001:columns'
 *     )
 *
 * To prevent confusion, this file contains helpers to contruct redis keys that
 * follow this naming convention.
 */

import { M365TenantInfo } from '@/config/app-env-vars/m365'
import { makeRedisAppDataKey } from '@/helpers/redis-app-data'

import { APP_KEY } from '../constants'

export function makeRedisKey(
  tenant: M365TenantInfo,
  objectId: string,
  key: string,
): string {
  return makeRedisAppDataKey(APP_KEY, `${tenant.id}:${objectId}:${key}`)
}
