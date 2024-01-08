import type { IGlobalVariable } from '@plumber/types'

import { getM365TenantInfo } from '@/config/app-env-vars/m365'

export async function createPlumberFolder(
  tenantKey: string,
  $: IGlobalVariable,
): Promise<string> {
  if (!$.user.email) {
    throw new Error('User email unavailable')
  }

  const tenant = getM365TenantInfo(tenantKey)

  // Create folder
  const createFolderResult = await $.http.post<{ id: string }>(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/root/children`,
    {
      name: $.user.email,
      folder: {},
    },
  )
  const folderId = createFolderResult.data.id

  // Allow user R/W access to folder.
  await $.http.post(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${folderId}/invite`,
    {
      recipients: [{ email: $.user.email }],
      requireSignIn: true,
      sendInvitation: false,
      roles: ['read', 'write'],
      retainInheritedPermissions: false,
    },
  )

  return folderId
}
