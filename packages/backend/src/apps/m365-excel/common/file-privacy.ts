import type { IHttpClient } from '@plumber/types'

import z from 'zod'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'

import { AuthData } from './auth-data'

const fileInfoResponseSchema = z.object({
  sensitivityLabel: z.object({
    id: z.string().toUpperCase(),
  }),
  parentReference: z.object({
    id: z.string().toUpperCase(),
  }),
})

interface FilePrivacyInfo {
  sensitivityLabelGuid: string
  parentDirectoryId: string
}

async function queryFilePrivacyInfo(
  tenant: M365TenantInfo,
  fileId: string,
  http: IHttpClient,
): Promise<FilePrivacyInfo> {
  const fileInfo = fileInfoResponseSchema.parse(
    (
      await http.get(
        `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel,parentReference`,
      )
    ).data,
  )

  return {
    sensitivityLabelGuid: fileInfo.sensitivityLabel.id,
    parentDirectoryId: fileInfo.parentReference.id,
  }
}

export async function validateCanAccessFile(
  authData: AuthData,
  fileId: string,
  http: IHttpClient,
): Promise<void> {
  const tenant = getM365TenantInfo(authData.tenantKey)
  const plumberFolderId = authData.folderId

  const { sensitivityLabelGuid, parentDirectoryId } =
    await queryFilePrivacyInfo(tenant, fileId, http)

  if (plumberFolderId !== parentDirectoryId) {
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
