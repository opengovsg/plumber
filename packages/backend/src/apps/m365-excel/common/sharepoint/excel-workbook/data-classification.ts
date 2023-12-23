import type { IHttpClient } from '@plumber/types'

import { type M365TenantInfo } from '@/config/app-env-vars/m365'

import { RedisCachedValue } from '../../redis-cached-value'

import { SENSITIVITY_LABEL_CACHE_LIFETIME_SECONDS } from './constants'

function initRedisCache(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): RedisCachedValue<string> {
  return new RedisCachedValue({
    tenant,
    objectId: fileId,
    cacheKey: 'sensitivity-label',
    expirySeconds: SENSITIVITY_LABEL_CACHE_LIFETIME_SECONDS,
    extendExpiryOnRead: false,
    queryValueFromSource: async () => {
      const response = await http.get<{
        sensitivityLabel: {
          id: string
          protectionEnabled: boolean
        }
      }>(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel`,
      )

      // Programming a bit more defensively with lots of nullish coalescing as this
      // API is not well-documented.
      return response.data?.sensitivityLabel?.id?.toUpperCase() ?? null
    },
  })
}

export async function isFileTooSensitive(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): Promise<boolean> {
  const cachedValue = initRedisCache(tenant, fileId, http)

  const isAllowedSensitivity = tenant.allowedSensitivityLabelGuids.has(
    await cachedValue.get(),
  )

  return !isAllowedSensitivity
}
