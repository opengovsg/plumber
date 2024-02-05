import type { IHttpClient } from '@plumber/types'

import z from 'zod'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'
import logger from '@/helpers/logger'

import { AuthData } from './auth-data'

// https://learn.microsoft.com/en-us/graph/api/resources/permission?view=graph-rest-1.0#roles-property-values
const sharePointRolesSchema = z.array(z.enum(['read', 'write', 'owner']))

// https://learn.microsoft.com/en-us/graph/api/resources/sharepointidentityset?view=graph-rest-1.0
const sharepointFilePermissionsSchema = z
  .object({
    value: z.array(
      z.object({
        roles: sharePointRolesSchema,
      }),
    ),
  })
  .transform((response) => response.value)

/**
 * ONLY USED FOR BACKUP!
 *
 * See comment block in fileInfoResponseSchema for more context.
 *
 * At the time of writing, this should never be invoked. If an alert fires and
 * you're looking at this, MS has stopped sending user emails together with file
 * permissions obtained via an expand (i.e. `$expand=permissions`).
 *
 * To resolve, try to find an alternative method to get user emails without
 * spending an extra query. If that is no longer possible, then we have no
 * choice - submit a PR to use this function to check permissions without
 * alerting.
 */
async function userHasWriteAccessAccordingToSharePointFilePermissionsFORBACKUPONLY(
  tenant: M365TenantInfo,
  fileId: string,
  userEmail: string,
  http: IHttpClient,
): Promise<boolean> {
  logger.error(
    'Queried SharePoint file permissions; check source code for next steps',
    {
      event: 'm365-queried-sharepoint-file-permissions',
    },
  )

  // On M365, we're guaranteed that SharePoint's login name ends with the
  // user's email. So this queries for permissions via a suffix filter on
  // siteUser.loginName, which is a documented field.
  //
  // More info:
  // - siteUser.loginName format:
  //   https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/get-user-identity-and-properties-in-sharepoint#retrieve-current-website-user-identity-by-using-the-web-object
  // - Schema:
  //   https://learn.microsoft.com/en-us/graph/api/resources/sharepointidentity?view=graph-rest-1.0
  const sharePointFilePermissionsResponse = await http.get(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/permissions?$filter=endsWith(grantedToV2/siteUser/loginName,'${userEmail}')&$select=grantedToV2,roles`,
  )
  const permissions = sharepointFilePermissionsSchema.parse(
    sharePointFilePermissionsResponse.data,
  )

  return permissions.some(
    (p) => p.roles.includes('write') || p.roles.includes('owner'),
  )
}

// https://learn.microsoft.com/en-us/graph/api/resources/permission?view=graph-rest-1.0
//
// NOTE: We're very loose with parsing this as we're _only_ interested in users,
// but MS Graph may return other identities like app identities.
const permissionUserSchema = z.object({
  user: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
})
const permissionSchema = z
  .object({
    roles: sharePointRolesSchema,
    grantedTo: permissionUserSchema.optional(),
    grantedToV2: permissionUserSchema.optional(),

    // NOTE: we do not process grantedToIdentities nor grantedToIdentitiesV2
    // because they are only applicable for shared links, not files.
  })
  .transform((permission) => ({
    roles: permission.roles,
    email:
      permission.grantedToV2?.user?.email ??
      permission.grantedTo?.user?.email ??
      null,
  }))

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
    permissions: z.array(permissionSchema),
  })
  .transform((response) => {
    // EDGE CASE: Technically, the email field in grantedTo.user is undocumented
    // and there is a very small chance that MS Graph will stop returning it. We
    // only use it because it allows us to save 1 query per file access.
    //
    // To mitigate the risk of using this field, we want to detect if its is
    // deprecated by Microsoft (and fall back to
    // userHasWriteAccessAccordingToSharePointFilePermissionsFORBACKUPONLY).
    // This flag serves this purpose.
    //
    // We know that under normal operation, we should always receive at least 1
    // email: the plumber folder owner's email (it is, at the time of coding,
    // not possible to revoke themselves from their own folder). Thus we know
    // that the email field is truly gone if _all_ permissions no longer have
    // emails.
    const canUseEmailField = response.permissions.some((p) => !!p.email)

    let usersWithWriteAccess: Set<string> | null = null
    if (canUseEmailField) {
      usersWithWriteAccess = new Set<string>()

      const writePermissions = response.permissions.filter(
        (p) => p.roles.includes('write') || p.roles.includes('owner'),
      )

      for (const permission of writePermissions) {
        if (permission.email) {
          usersWithWriteAccess.add(permission.email)
        }
      }
    }

    return {
      sensitivityLabelGuid: response.sensitivityLabel.id ?? null,
      usersWithWriteAccess: usersWithWriteAccess,
      parentDriveType: response.parentReference.driveType,
      parentDirectoryId: response.parentReference.id,
      siteId: response.parentReference.siteId ?? null,
    }
  })

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
    // CAVEAT: It's possible for users to rename their Plumber folder, but
    // folder ID remains the same after renaming. It's unsightly, but I don't
    // see any reason to fail a pipe just because a user renamed their folder.
    //
    // (This means it's possible for users to DoS other users by renaming their
    // folder to the victim's email, but we can track such abusers and follow up
    // with them.)
    throw new Error('File must be in your Plumber folder')
  }

  const userCanWriteToFile = usersWithWriteAccess
    ? usersWithWriteAccess.has(userEmail)
    : await userHasWriteAccessAccordingToSharePointFilePermissionsFORBACKUPONLY(
        tenant,
        fileId,
        userEmail,
        http,
      )
  if (!userCanWriteToFile) {
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
