import type { IHttpClient } from '@plumber/types'

import z from 'zod'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'

import { AuthData } from './auth-data'

const fileInfoResponseSchema = z
  .object({
    sensitivityLabel: z.object({
      id: z.string().toUpperCase().nullish(),
    }),
    // https://learn.microsoft.com/en-us/graph/api/resources/itemreference?view=graph-rest-1.0
    parentReference: z.object({
      driveType: z.enum(['documentLibrary', 'personal', 'business']),
      id: z.string().toUpperCase(),
      siteId: z.string().toUpperCase().nullish(),
    }),
    // https://learn.microsoft.com/en-us/graph/api/resources/permission?view=graph-rest-1.0
    permissions: z.array(
      z.object({
        roles: z.array(z.enum(['read', 'write', 'owner'])),
        // Documented as deprecated in favor of grantedToV2, but have been
        // unable to query V2 in my own testing.
        // FIXME (ogp-weeloong): migrate to V2 when property is available.
        grantedTo: z.object({
          user: z.object({
            email: z.string().email(),
          }),
        }),
      }),
    ),
  })
  .transform((response) => ({
    sensitivityLabelGuid: response.sensitivityLabel.id ?? null,
    usersWithWriteAccess: new Set(
      response.permissions
        .filter((p) => p.roles.includes('write') || p.roles.includes('owner'))
        .map((p) => p.grantedTo.user.email),
    ),
    parentDriveType: response.parentReference.driveType,
    parentDirectoryId: response.parentReference.id,
    siteId: response.parentReference.siteId ?? null,
  }))

async function queryFilePrivacyInfo(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): Promise<z.infer<typeof fileInfoResponseSchema>> {
  return fileInfoResponseSchema.parse(
    (
      await http.get(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel,parentReference&$expand=permissions`,
      )
    ).data,
  )
}

export async function validateCanAccessFile(
  userEmail: string,
  authData: AuthData,
  fileId: string,
  http: IHttpClient,
): Promise<void> {
  const tenant = getM365TenantInfo(authData.tenantKey)
  const plumberFolderId = authData.folderId

  const {
    parentDriveType,
    parentDirectoryId,
    sensitivityLabelGuid,
    siteId,
    usersWithWriteAccess,
  } = await queryFilePrivacyInfo(tenant, fileId, http)

  if (
    !(
      parentDriveType === 'documentLibrary' &&
      plumberFolderId === parentDirectoryId &&
      siteId === tenant.sharePointSiteId
    )
  ) {
    throw new Error('File must be in your Plumber folder')
  }

  if (!usersWithWriteAccess.has(userEmail)) {
    throw new Error(
      'You do not have write access and cannot operate on this file.',
    )
  }

  if (!sensitivityLabelGuid) {
    throw new Error('File does not have a sensitivity label')
  }

  const isAllowedSensitivity =
    tenant.allowedSensitivityLabelGuids.has(sensitivityLabelGuid)
  if (!isAllowedSensitivity) {
    throw new Error(
      'File is too sensitive; Plumber is only cleared to handle data up to Restricted and Sensitive-Normal.',
    )
  }
}
