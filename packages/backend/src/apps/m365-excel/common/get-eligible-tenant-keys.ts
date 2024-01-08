import appConfig from '@/config/app'
import { type M365TenantKey, m365TenantKeys } from '@/config/app-env-vars/m365'
import { getLdFlagValue } from '@/helpers/launch-darkly'

export default async function getEligibleTenantKeys(
  userEmail: string,
): Promise<ReadonlySet<M365TenantKey>> {
  const result = new Set<M365TenantKey>()

  // Get eligible tenants from LD.
  const potentialTenants = await Promise.all(
    m365TenantKeys.map(async (tenantKey) => ({
      key: tenantKey,
      isEligible: await getLdFlagValue(
        `backend_m365_tenant_${tenantKey}`,
        userEmail,
        false,
      ),
    })),
  )
  for (const tenant of potentialTenants) {
    if (!tenant.isEligible) {
      continue
    }
    result.add(tenant.key)
  }

  if (appConfig.isDev) {
    result.add('local-dev')
    result.add('govtech-staging')
  }

  return result
}
