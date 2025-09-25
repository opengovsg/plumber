import type { IDynamicData } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'
import StepError from '@/errors/step'

import { extractAuthDataWithPlumberFolder } from '../../common/auth-data'
import { validateCanAccessFile } from '../../common/file-privacy'

import { parametersSchema } from './schema'

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

    const parametersParseResult = parametersSchema.safeParse($.step.parameters)
    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
        $.step.position,
        $.app.name,
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
      $.flow?.collaborators,
    )

    const tenant = getM365TenantInfo(authData.tenantKey)

    const results = await $.http.get<{
      value: Array<{ id: string; name: string }>
    }>(
      '/v1.0/sites/:sharePointSiteId/drive/items/:fileId/workbook/worksheets?$select=id,name',
      {
        urlPathParams: {
          fileId,
          sharePointSiteId: tenant.sharePointSiteId,
        },
      },
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
