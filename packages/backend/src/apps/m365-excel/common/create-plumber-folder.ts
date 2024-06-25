import type { IGlobalVariable } from '@plumber/types'

import { getM365TenantInfo, M365TenantInfo } from '@/config/app-env-vars/m365'
import HttpError from '@/errors/http'

import { tryParseGraphApiError } from './parse-graph-api-error'

async function checkForExistingFolder(
  $: IGlobalVariable,
  tenant: M365TenantInfo,
): Promise<string> {
  const filterQueryParams = new URLSearchParams({
    filter: `name eq '${$.user.email}'`,
    select: 'id',
  }).toString()

  const getFolderIdResult = await $.http.get<{ value: { id: string }[] }>(
    `/v1.0/sites/:sharePointSiteId/drive/root/children?${filterQueryParams}`,
    {
      urlPathParams: {
        sharePointSiteId: tenant.sharePointSiteId,
      },
    },
  )

  return getFolderIdResult.data?.value?.[0]?.id
}

export async function createPlumberFolder(
  tenantKey: string,
  $: IGlobalVariable,
): Promise<string> {
  if (!$.user.email) {
    throw new Error('User email unavailable')
  }

  const tenant = getM365TenantInfo(tenantKey)

  // Create folder
  let folderId = ''
  try {
    const createFolderResult = await $.http.post<{ id: string }>(
      '/v1.0/sites/:sharePointSiteId/drive/root/children',
      {
        name: $.user.email,
        folder: {},
      },
      {
        urlPathParams: {
          sharePointSiteId: tenant.sharePointSiteId,
        },
      },
    )
    folderId = createFolderResult.data.id
  } catch (error) {
    const folderAlreadyExists =
      error instanceof HttpError &&
      tryParseGraphApiError(error)?.code === 'nameAlreadyExists'
    if (!folderAlreadyExists) {
      throw error
    }

    folderId = await checkForExistingFolder($, tenant)
  }

  if (!folderId) {
    throw new Error(
      'There was a problem creating your folder. Please contact support@plumber.gov.sg for assistance.',
    )
  }

  // Make user the folder owner.
  // NOTE: If they already have an existing folder, then this becomes a no-op.
  await $.http.post(
    '/v1.0/sites/:sharePointSiteId/drive/items/:folderId/invite',
    {
      recipients: [{ email: $.user.email }],
      requireSignIn: true,
      sendInvitation: false,
      roles: ['sp.full control'],
      retainInheritedPermissions: false,
    },
    {
      urlPathParams: {
        sharePointSiteId: tenant.sharePointSiteId,
        folderId,
      },
    },
  )

  return folderId
}
