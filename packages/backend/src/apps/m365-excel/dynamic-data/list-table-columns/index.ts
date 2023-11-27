import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { getRegisteredAuthData } from '../../common/auth-data'

const dynamicData: IDynamicData = {
  name: 'List Table Columns',
  key: 'listTableColumns',

  async run($) {
    const { fileId, tableId } = $.step.parameters
    if (!fileId || !tableId) {
      return {
        data: [],
      }
    }

    const authData = getRegisteredAuthData($)
    const tenant = getM365TenantInfo(authData.tenantKey)
    const results = await $.http.get<{
      value: Array<{ index: number; name: string }>
    }>(
      `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/tables/${tableId}/columns?$select=index,name&$orderby=index`,
    )

    return {
      data: results.data.value.map((entry) => ({
        name: `Column ${entry.index} (${entry.name})`,
        // We return indices because excel works with indices, not names.
        value: String(entry.index),
      })),
    }
  },
}

export default dynamicData
