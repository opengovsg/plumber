import type { IHttpClient } from '@plumber/types'

import { type M365TenantInfo } from '@/config/app-env-vars/m365'

async function querySensitivityLabelGuid(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): Promise<string | null> {
  const sensitivityResponse = await http.get<{
    sensitivityLabel: {
      id: string
      protectionEnabled: boolean
    }
  }>(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel`,
  )

  // Programming a bit more defensively with lots of nullish coalescing as this
  // API is not well-documented.
  return sensitivityResponse.data?.sensitivityLabel?.id?.toUpperCase() ?? null
}

export async function isFileTooSensitive(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): Promise<boolean> {
  const fileSensitivityLabelGuid = await querySensitivityLabelGuid(
    tenant,
    fileId,
    http,
  )

  const isAllowedSensitivity = tenant.allowedSensitivityLabelGuids.has(
    fileSensitivityLabelGuid,
  )

  return !isAllowedSensitivity
}
