import type { IAuth } from '@plumber/types'

import { isM365TenantKey } from '@/config/app-env-vars/m365'

import getEligibleTenantKeys from '../common/get-eligible-tenant-keys'

const isStillVerified: NonNullable<IAuth['isStillVerified']> = async function (
  $,
) {
  const tenantKey = $.auth?.data?.tenantKey as string

  if (!tenantKey || !isM365TenantKey(tenantKey)) {
    return false
  }
  return (await getEligibleTenantKeys($.user?.email)).has(tenantKey)
}

export default isStillVerified
