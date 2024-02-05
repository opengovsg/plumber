import type { IHttpClient } from '@plumber/types'

import z from 'zod'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'

import { AuthData } from './auth-data'

// https://learn.microsoft.com/en-us/graph/api/resources/permission?view=graph-rest-1.0
//
// NOTE: We're very loose with parsing this as we're _only_ interested in users,
// but MS Graph may return other identities like app identities. We parse what
// we can and then collate all user emails into an array via a transform (hence
// the variable name).
const permissionUserSchema = z.object({
  user: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
})
const permissionSchemaWithCollatedEmails = z
  .object({
    roles: z.array(z.enum(['read', 'write', 'owner'])),

    // https://learn.microsoft.com/en-us/graph/api/resources/identityset?view=graph-rest-1.0
    grantedTo: permissionUserSchema.optional(),
    grantedToIdentities: z.array(permissionUserSchema).optional(),

    // https://learn.microsoft.com/en-us/graph/api/resources/sharepointidentityset?view=graph-rest-1.0
    grantedToV2: permissionUserSchema.optional(),
    grantedToIdentitiesV2: z.array(permissionUserSchema).optional(),
  })
  .transform((permission) => {
    // Potentially empty
    const emails = new Set<string>()

    emails.add(permission.grantedTo?.user?.email ?? '')
    emails.add(permission.grantedToV2?.user?.email ?? '')
    for (const identity of permission.grantedToIdentities ?? []) {
      emails.add(identity.user?.email ?? '')
    }
    for (const identity of permission.grantedToIdentitiesV2 ?? []) {
      emails.add(identity.user?.email ?? '')
    }

    return {
      roles: permission.roles,
      emails: Array.from(emails).filter((email) => email.length > 0),
    }
  })

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
    permissions: z.array(permissionSchemaWithCollatedEmails),
  })
  .transform((response) => ({
    sensitivityLabelGuid: response.sensitivityLabel.id ?? null,
    usersWithWriteAccess: new Set(
      response.permissions
        .filter((p) => p.roles.includes('write') || p.roles.includes('owner'))
        .flatMap((p) => p.emails),
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
  const response = await http.get(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/?$select=sensitivityLabel,parentReference&$expand=permissions`,
  )
  return fileInfoResponseSchema.parse(response.data)
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
