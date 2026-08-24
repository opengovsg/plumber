import { isIP } from 'net'

import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import {
  DISALLOWED_IP_RESOLVED_ERROR,
  INVALID_URL_ERROR,
  RECURSIVE_WEBHOOK_ERROR,
} from './constants'
import { isIpAllowed } from './ip-resolver'

const checkUrls: TBeforeRequest = async ($, requestConfig) => {
  // Prohibit calling ourselves to prevent self-DoS.
  if (requestConfig.baseURL.toLowerCase().endsWith('plumber.gov.sg')) {
    throw new Error(RECURSIVE_WEBHOOK_ERROR)
  }

  let url
  try {
    url = new URL(requestConfig.baseURL)
  } catch {
    throw new Error(INVALID_URL_ERROR)
  }

  // Not confident that this will not break pipes yet, so logging it for now
  if (url.protocol !== 'https:') {
    logger.warn('Non https url found', {
      url: requestConfig.baseURL,
      executionId: $.execution?.id,
      flowId: $.flow?.id,
      stepId: $.step?.id,
    })
  }

  /**
   * If hostname is IP, dns lookup will not be called so we check for forbidden IPs here as well
   */
  if (isIP(url.hostname) > 0 && !isIpAllowed(url.hostname)) {
    throw new Error(DISALLOWED_IP_RESOLVED_ERROR)
  }
  return requestConfig
}

export default checkUrls
