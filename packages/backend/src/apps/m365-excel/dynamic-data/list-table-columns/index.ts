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
    const columnNames = (
      await $.http.get<{
        value: Array<{ name: string }>
      }>(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/tables/${tableId}/columns?$select=name&$orderby=index`,
      )
    ).data.value.map((column) => column.name)

    return {
      data: columnNames.map((columnName) => ({
        name: columnName,
        value: columnName,
      })),
    }
  },
}

export default dynamicData
