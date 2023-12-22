import type { IGlobalVariable } from '@plumber/types'

import { M365TenantInfo } from '@/config/app-env-vars/m365'

import { RedisCachedValue } from '../../redis-cached-value'

import {
  DEFAULT_CACHE_LIFETIME_SECONDS,
  type ExcelTable,
  type ExcelTableColumn,
  type ExcelWorksheet,
} from './constants'

//
// Helper functions to make RedisCachedValues because er... the constructor is a
// bit verbose.
//

export function initCachedTables(
  $: IGlobalVariable,
  tenant: M365TenantInfo,
  fileId: string,
): RedisCachedValue<ExcelTable[]> {
  return new RedisCachedValue({
    tenant,
    objectId: fileId,
    cacheKey: 'excel:tables',
    expirySeconds: DEFAULT_CACHE_LIFETIME_SECONDS,
    extendExpiryOnRead: false,
    queryValueFromSource: async () => {
      const response = await $.http.get<{
        value: ExcelTable[]
      }>(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/tables?$select=id,name`,
      )
      return response.data.value
    },
  })
}

export function initCachedWorksheets(
  $: IGlobalVariable,
  tenant: M365TenantInfo,
  fileId: string,
): RedisCachedValue<ExcelWorksheet[]> {
  return new RedisCachedValue({
    tenant,
    objectId: fileId,
    cacheKey: 'excel:worksheets',
    expirySeconds: DEFAULT_CACHE_LIFETIME_SECONDS,
    extendExpiryOnRead: false,
    queryValueFromSource: async () => {
      const response = await $.http.get<{
        value: ExcelWorksheet[]
      }>(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/worksheets?$select=id,name`,
      )
      return response.data.value
    },
  })
}

export function initCachedTableColumns(
  $: IGlobalVariable,
  tenant: M365TenantInfo,
  fileId: string,
  tableId: string,
): RedisCachedValue<ExcelTableColumn[]> {
  return new RedisCachedValue({
    tenant: tenant,
    objectId: fileId,
    cacheKey: `excel:tables:${tableId}:columns`,
    expirySeconds: DEFAULT_CACHE_LIFETIME_SECONDS,
    extendExpiryOnRead: false,
    queryValueFromSource: async () => {
      const response = await $.http.get<{
        value: Array<{ index: number; name: string }>
      }>(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/tables/${tableId}/columns?$select=index,name&$orderby=index`,
      )

      return response.data.value.map((entry) => ({
        name: `Column ${entry.index} (${entry.name})`,
        // We return indices because excel works with indices, not names.
        value: String(entry.index),
      }))
    },
  })
}
