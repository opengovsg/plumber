import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { getRegisteredAuthData } from '../../common/auth-data'

const dynamicData: IDynamicData = {
  name: 'List Tables',
  key: 'listTables',

  async run($) {
    const { fileId } = $.step.parameters
    if (!fileId) {
      return {
        data: [],
      }
    }

    const authData = getRegisteredAuthData($)
    const tenant = getM365TenantInfo(authData.tenantKey)
    const results = await $.http.get<{
      value: Array<{ id: string; name: string }>
    }>(
      `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/tables?$select=id,name`,
    )

    return {
      data: results.data.value.map((entry) => ({
        name: entry.name,
        value: entry.id,
      })),
    }
  },
}

export default dynamicData
