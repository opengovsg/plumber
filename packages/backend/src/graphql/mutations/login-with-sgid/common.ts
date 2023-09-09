import { SgidClient } from '@opengovsg/sgid-client'

import appConfig from '@/config/app'

export const sgidClient = new SgidClient({
  clientId: appConfig.sgid.clientId,
  clientSecret: appConfig.sgid.clientSecret,
  privateKey: appConfig.sgid.privateKey,
  redirectUri: `${appConfig.webAppUrl}/login/sgid/redirect`,
})

export const SGID_COOKIE_NAME = 'plumber-sgid'
export const SGID_COOKIE_TTL_SECONDS = 300 // 5 minutes

// FIXME (ogp-weeloong): Very tempted to put this in @types/plumber, but seems
// too specific, since GraphQL codegen should remove the need to do this.
export interface PublicOfficerEmployment {
  workEmail: string | null
  agencyName: string | null
  departmentName: string | null
  employmentType: string | null
  employmentTitle: string | null
}

export interface InitialStep {
  authCode: string
  nonce: string
  verifier: string
}

export interface SpecificEmployment {
  employmentIndex: number
}

export interface LoginWithSgidParams {
  input: {
    type: 'INITIAL_STEP' | 'SPECIFIC_EMPLOYMENT'
    initialStep?: InitialStep
    specificEmployment?: SpecificEmployment
  }
}

export interface LoginWithSgidResult {
  nextUrl?: string
  publicOfficerEmployments?: PublicOfficerEmployment[]
}
