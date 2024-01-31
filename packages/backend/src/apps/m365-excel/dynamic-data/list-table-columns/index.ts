import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'
import { validateCanAccessFile } from '../../common/file-privacy'

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

    const authData = extractAuthDataWithPlumberFolder($)

    // Did not want to open a workbook session as user could just be casually
    // browsing through files, so directly invoke access validation.
    // FIXME (ogp-weeloong): move to a central file metadata cache to remove
    // need for this check
    await validateCanAccessFile(authData, fileId as string, $.http)

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
