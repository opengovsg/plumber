import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { getRegisteredAuthData } from '../../common/auth-data'
import { ExcelWorkbook } from '../../common/sharepoint/excel-workbook'

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
    const workbook = await ExcelWorkbook.init($, tenant, fileId as string)
    const columns = await workbook.getTableColumns(tableId as string)

    return {
      data: columns,
    }
  },
}

export default dynamicData
