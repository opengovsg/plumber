import z from 'zod'

import appConfig from '../app'

if (!appConfig) {
  throw new Error('Cyclic import of appConfig from app-env-vars')
}

const sensitivityLabelGuidsSchema = z
  .string()
  .trim()
  .transform((val) => val.split(','))
  .pipe(
    z
      .array(
        z
          .string()
          .trim()
          // Microsoft's GUID is just a UUID :/
          .uuid()
          .transform((guid) => guid.toUpperCase()),
      )
      // Must have at least 1 item; otherwise, no file can be processed.
      .min(1)
      .transform((guids) => new Set<string>(guids)),
  )

export interface M365TenantInfo {
  // Internal descriptive label for easier referencing
  label: string

  id: string
  sharePointSiteId: string
  clientId: string
  clientThumbprint: string
  clientPrivateKey: string

  allowedSensitivityLabelGuids: ReadonlySet<string>
}

function makeTenantInfo(opts: Partial<M365TenantInfo>): M365TenantInfo {
  const {
    label,
    id,
    sharePointSiteId,
    clientId,
    clientThumbprint,
    clientPrivateKey,
    allowedSensitivityLabelGuids,
  } = opts

  if (
    !label ||
    !id ||
    !sharePointSiteId ||
    !clientId ||
    !clientThumbprint ||
    !clientPrivateKey
  ) {
    throw new Error(
      `M365 tenant '${
        label ?? 'missing-label'
      }' env vars need to be configured!`,
    )
  }

  return {
    label,
    id,
    sharePointSiteId,
    clientId,
    clientThumbprint,
    clientPrivateKey,
    allowedSensitivityLabelGuids,
  }
}

export const m365TenantInfo = Object.freeze({
  'sg-govt': makeTenantInfo({
    label: 'SG Govt SharePoint',
    id: process.env.M365_SG_GOVT_TENANT_ID,
    sharePointSiteId: process.env.M365_SG_GOVT_SHAREPOINT_SITE_ID,
    clientId: process.env.M365_SG_GOVT_CLIENT_ID,
    clientThumbprint: process.env.M365_SG_GOVT_CLIENT_THUMBPRINT,
    clientPrivateKey: process.env.M365_SG_GOVT_CLIENT_PRIVATE_KEY,
    allowedSensitivityLabelGuids: sensitivityLabelGuidsSchema.parse(
      process.env.M365_SG_GOVT_ALLOWED_SENSITIVITY_LABEL_GUIDS_CSV,
    ),
  }),
  ...(appConfig.isDev
    ? {
        'govtech-staging': makeTenantInfo({
          label: 'GovTech Staging SharePoint',
          id: process.env.M365_GOVTECH_STAGING_TENANT_ID,
          sharePointSiteId: process.env.M365_GOVTECH_STAGING_SHAREPOINT_SITE_ID,
          clientId: process.env.M365_GOVTECH_STAGING_CLIENT_ID,
          clientThumbprint: process.env.M365_GOVTECH_STAGING_CLIENT_THUMBPRINT,
          clientPrivateKey: process.env.M365_GOVTECH_STAGING_CLIENT_PRIVATE_KEY,
          allowedSensitivityLabelGuids: sensitivityLabelGuidsSchema.parse(
            process.env
              .M365_GOVTECH_STAGING_ALLOWED_SENSITIVITY_LABEL_GUIDS_CSV,
          ),
        }),
        'local-dev': makeTenantInfo({
          label: 'Local Development SharePoint',
          id: process.env.M365_LOCAL_DEV_TENANT_ID,
          sharePointSiteId: process.env.M365_LOCAL_DEV_SHAREPOINT_SITE_ID,
          clientId: process.env.M365_LOCAL_DEV_CLIENT_ID,
          clientThumbprint: process.env.M365_LOCAL_DEV_CLIENT_THUMBPRINT,
          clientPrivateKey: process.env.M365_LOCAL_DEV_CLIENT_PRIVATE_KEY,
          allowedSensitivityLabelGuids: sensitivityLabelGuidsSchema.parse(
            process.env.M365_LOCAL_DEV_ALLOWED_SENSITIVITY_LABEL_GUIDS_CSV,
          ),
        }),
      }
    : {}),
})

//
// Convenience stuff
//

export type M365TenantKey = keyof typeof m365TenantInfo

// OK to cast Object.keys since m365TenantInfo is frozen.
export const m365TenantKeys = Object.keys(
  m365TenantInfo,
) as Array<M365TenantKey>

export function isM365TenantKey(key: string): key is M365TenantKey {
  return Object.keys(m365TenantInfo).includes(key)
}

export function getM365TenantInfo(key: string): M365TenantInfo {
  if (!isM365TenantKey(key)) {
    throw new Error(`${key} is an invalid M365 tenant.`)
  }
  return m365TenantInfo[key]
}
