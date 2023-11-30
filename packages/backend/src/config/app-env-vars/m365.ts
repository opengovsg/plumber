import appConfig from '../app'

if (!appConfig) {
  throw new Error('Cyclic import of appConfig from app-env-vars')
}

export interface M365TenantInfo {
  // Internal descriptive label for easier referencing
  label: string

  id: string
  sharePointSiteId: string
  clientId: string
  clientThumbprint: string
  clientPrivateKey: string
}

function makeTenantInfo(opts: Partial<M365TenantInfo>): M365TenantInfo {
  const {
    label,
    id,
    sharePointSiteId,
    clientId,
    clientThumbprint,
    clientPrivateKey,
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
  }
}

export const m365TenantInfo = Object.freeze({
  'sg-govt': makeTenantInfo({
    label: 'SG Govt',
    id: process.env.M365_SG_GOVT_TENANT_ID,
    sharePointSiteId: process.env.M365_SG_GOVT_SHAREPOINT_SITE_ID,
    clientId: process.env.M365_SG_GOVT_CLIENT_ID,
    clientThumbprint: process.env.M365_SG_GOVT_CLIENT_THUMBPRINT,
    clientPrivateKey: process.env.M365_SG_GOVT_CLIENT_PRIVATE_KEY,
  }),
  ...(appConfig.isDev
    ? {
        'govtech-staging': makeTenantInfo({
          label: 'GovTech Staging',
          id: process.env.M365_GOVTECH_STAGING_TENANT_ID,
          sharePointSiteId: process.env.M365_GOVTECH_STAGING_SHAREPOINT_SITE_ID,
          clientId: process.env.M365_GOVTECH_STAGING_CLIENT_ID,
          clientThumbprint: process.env.M365_GOVTECH_STAGING_CLIENT_THUMBPRINT,
          clientPrivateKey: process.env.M365_GOVTECH_STAGING_CLIENT_PRIVATE_KEY,
        }),
        'local-dev': makeTenantInfo({
          label: 'Local Development',
          id: process.env.M365_LOCAL_DEV_TENANT_ID,
          sharePointSiteId: process.env.M365_LOCAL_DEV_SHAREPOINT_SITE_ID,
          clientId: process.env.M365_LOCAL_DEV_CLIENT_ID,
          clientThumbprint: process.env.M365_LOCAL_DEV_CLIENT_THUMBPRINT,
          clientPrivateKey: process.env.M365_LOCAL_DEV_CLIENT_PRIVATE_KEY,
        }),
      }
    : {}),
})

export const m365RateLimits = Object.freeze({
  graphApi: {
    points: 13000,
    durationSeconds: 10,
  },
  sharePoint: {
    points: 3000,
    durationSeconds: 60,
  },
  excel: {
    points: 1500,
    durationSeconds: 10,
  },
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
