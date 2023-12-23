import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { getRegisteredAuthData } from '../../common/auth-data'
import { ExcelWorkbook } from '../../common/sharepoint/excel-workbook'

const dynamicData: IDynamicData = {
  name: 'List Worksheets',
  key: 'listWorksheets',

  async run($) {
    const { fileId } = $.step.parameters
    if (!fileId) {
      return {
        data: [],
      }
    }

    const authData = getRegisteredAuthData($)
    const tenant = getM365TenantInfo(authData.tenantKey)
    const workbook = await ExcelWorkbook.init($, tenant, fileId as string)
    const worksheets = await workbook.getWorksheets()

    return {
      data: worksheets.map((worksheet) => ({
        name: worksheet.name,
        value: worksheet.id,
      })),
    }
  },
}

export default dynamicData
