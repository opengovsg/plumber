import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'
import StepError from '@/errors/step'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'
import { validateCanAccessFile } from '../../common/file-privacy'
import { parametersSchema } from './schema'

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

    const parametersParseResult = parametersSchema.safeParse($.step.parameters)
    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
      )
    }

    const authData = extractAuthDataWithPlumberFolder($)

    // Did not want to open a workbook session as user could just be casually
    // browsing through files, so directly invoke access validation.
    // FIXME (ogp-weeloong): move to a central file metadata cache to remove
    // need for this check
    await validateCanAccessFile(
      $.user?.email,
      authData,
      fileId as string,
      $.http,
    )

    const tenant = getM365TenantInfo(authData.tenantKey)

    const columnNames = (
      await $.http.get<{
        value: Array<{ name: string }>
      }>(
        '/v1.0/sites/:sharePointSiteId/drive/items/:fileId/workbook/tables/:tableId/columns?$select=name&$orderby=index',
        {
          urlPathParams: {
            fileId,
            tableId,
            sharePointSiteId: tenant.sharePointSiteId,
          },
        },
      )
    ).data.value.map((column: { name: string }) => column.name)

    return {
      data: columnNames.map((columnName: string) => ({
        name: columnName,
        value: columnName,
      })),
    }
  },
}

export default dynamicData
