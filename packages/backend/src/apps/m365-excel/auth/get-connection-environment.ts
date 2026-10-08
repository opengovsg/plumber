import type { IConnectionEnvironment, IJSONObject } from '@plumber/types'

import { getM365TenantInfo, isM365TenantKey } from '@/config/app-env-vars/m365'

export default function getConnectionEnvironment(
  formattedData?: IJSONObject,
): IConnectionEnvironment | null {
  const tenantKey = formattedData?.tenantKey
  if (typeof tenantKey !== 'string' || !isM365TenantKey(tenantKey)) {
    return null
  }

  return { id: tenantKey, label: getM365TenantInfo(tenantKey).label }
}
