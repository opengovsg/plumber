import type { IHttpClient } from '@plumber/types'

import z from 'zod'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'

import { AuthData } from './auth-data'

const driveTypeEnum = z.enum(['documentLibrary', 'personal', 'business'])

const fileInfoResponseSchema = z
  .object({
    sensitivityLabel: z.object({
      id: z.string().toUpperCase().nullish(),
    }),
    // https://learn.microsoft.com/en-us/graph/api/resources/itemreference?view=graph-rest-1.0
    parentReference: z.object({
      driveType: driveTypeEnum,
      id: z.string().toUpperCase(),
      siteId: z.string().toUpperCase().nullish(),
    }),
  })
  .transform((response) => ({
    sensitivityLabelGuid: response.sensitivityLabel.id ?? null,
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
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel,parentReference`,
      )
    ).data,
  )
}

export async function validateCanAccessFile(
  authData: AuthData,
  fileId: string,
  http: IHttpClient,
): Promise<void> {
  const tenant = getM365TenantInfo(authData.tenantKey)
  const plumberFolderId = authData.folderId

  const { parentDriveType, sensitivityLabelGuid, parentDirectoryId, siteId } =
    await queryFilePrivacyInfo(tenant, fileId, http)

  if (
    !(
      parentDriveType === 'documentLibrary' &&
      plumberFolderId === parentDirectoryId &&
      siteId === tenant.sharePointSiteId
    )
  ) {
    throw new Error('File must be in your Plumber folder')
  }

  if (!sensitivityLabelGuid) {
    throw new Error('File does not have a sensitivity label')
  }

  const isAllowedSensitivity =
    tenant.allowedSensitivityLabelGuids.has(sensitivityLabelGuid)
  if (!isAllowedSensitivity) {
    throw new Error('File is too sensitive')
  }
}
