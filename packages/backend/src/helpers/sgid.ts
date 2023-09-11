import { SgidClient } from '@opengovsg/sgid-client'

import appConfig from '@/config/app'

export const SGID_COOKIE_NAME = 'plumber-sgid'
export const SGID_COOKIE_TTL_SECONDS = 300 // 5 minutes

export const sgidClient = new SgidClient({
  clientId: appConfig.sgid.clientId,
  clientSecret: appConfig.sgid.clientSecret,
  privateKey: appConfig.sgid.privateKey,
  redirectUri: `${appConfig.webAppUrl}/login/sgid/redirect`,
})

export interface PublicOfficerEmployment {
  workEmail: string | null
  agencyName: string | null
  departmentName: string | null
  employmentType: string | null
  employmentTitle: string | null
}
