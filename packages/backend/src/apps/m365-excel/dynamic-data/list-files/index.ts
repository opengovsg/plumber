import type {
  DynamicDataOutput,
  IDynamicData,
  IGlobalVariable,
} from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

import type { AuthData } from '../../common/auth-data'

const dynamicData: IDynamicData = {
  name: 'List Files',
  key: 'listFiles',

  async run($: IGlobalVariable): Promise<DynamicDataOutput> {
    const authData = $.auth?.data as AuthData
    if (!authData || !authData.folderId || !authData.tenantKey) {
      throw new Error('Connect to M365 in the "Choose connection" step.')
    }

    const tenant = getM365TenantInfo(authData.tenantKey)
    const results = await $.http.get<{
      value: Array<{ name: string; id: string }>
    }>(
      '/v1.0/sites/:sharePointSiteId/drive/items/:folderId/children?$select=id,name',
      {
        urlPathParams: {
          folderId: authData.folderId,
          sharePointSiteId: tenant.sharePointSiteId,
        },
      },
    )

    return {
      data: results.data.value
        .map((entry: { name: string; id: string }) => ({
          name: entry.name,
          value: entry.id,
        }))
        .filter((entry: { name: string; value: string }) =>
          entry.name.endsWith('.xlsx'),
        ),
    }
  },
}

export default dynamicData
