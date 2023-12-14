import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { getRegisteredAuthData } from '../../common/auth-data'
import { isFileTooSensitive } from '../../common/data-classification'

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

    // Did not want to open a workbook session as user could just be casually
    // browsing through files.
    // FIXME (ogp-weeloong): move to a central file metadata cache to remove
    // need for this check
    if (await isFileTooSensitive(tenant, fileId as string, $.http)) {
      throw new Error(`File is too sensitive!`)
    }

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
