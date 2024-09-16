import { TBeforeRequest } from '@plumber/types'

import { isUrlAllowed } from './ip-resolver'

export const RECURSIVE_WEBHOOK_ERROR_NAME =
  'Recursively invoking Plumber webhooks is prohibited.'

export const DISALLOWED_IP_RESOLVED_ERROR =
  'The URL you are trying to call is not allowed.'

const checkUrls: TBeforeRequest = async ($, requestConfig) => {
  // Prohibit calling ourselves to prevent self-DoS.
  if (requestConfig.baseURL.toLowerCase().endsWith('plumber.gov.sg')) {
    throw new Error(RECURSIVE_WEBHOOK_ERROR_NAME)
  }

  // Prevent calling of internal IPs, e.g. aws metadata endpoint
  if (!(await isUrlAllowed(requestConfig.baseURL))) {
    throw new Error(DISALLOWED_IP_RESOLVED_ERROR)
  }

  return requestConfig
}

export default checkUrls
