import formsgSdk from '@opengovsg/formsg-sdk'
import { memoize } from 'lodash'

import appConfig from '@/config/app'

export function getApiBaseUrl(): URL {
  switch (appConfig.appEnv.toLowerCase()) {
    case 'staging':
      return new URL('https://staging.form.gov.sg/api')
    default:
      return new URL('https://form.gov.sg/api')
  }
}

export const getSdk = memoize(() => {
  switch (appConfig.appEnv.toLowerCase()) {
    case 'staging':
      return formsgSdk({
        mode: 'staging',
      })
    default:
      return formsgSdk({
        mode: 'production',
      })
  }
})
