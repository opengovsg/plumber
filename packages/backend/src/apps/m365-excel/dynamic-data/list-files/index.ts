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
      throw new Error('Invalid connection; missing tenant or folder!')
    }

    const tenant = getM365TenantInfo(authData.tenantKey)
    const results = await $.http.get<{
      value: Array<{ name: string; id: string }>
    }>(
      `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${authData.folderId}/children?$select=id,name`,
    )

    return {
      data: results.data.value
        .map((entry) => ({
          name: entry.name,
          value: entry.id,
        }))
        .filter((entry) => entry.name.endsWith('.xlsx')),
    }
  },
}

export default dynamicData
