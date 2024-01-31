import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'
import { validateCanAccessFile } from '../../common/file-privacy'

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

    const authData = extractAuthDataWithPlumberFolder($)

    // Did not want to open a workbook session as user could just be casually
    // browsing through files, so directly invoke access validation.
    // FIXME (ogp-weeloong): move to a central file metadata cache to remove
    // need for this check
    await validateCanAccessFile(authData, fileId as string, $.http)

    const tenant = getM365TenantInfo(authData.tenantKey)

    const results = await $.http.get<{
      value: Array<{ id: string; name: string }>
    }>(
      `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/worksheets?$select=id,name`,
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
