import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const apiKey = $.auth.data.apiKey

  if (typeof apiKey !== 'string') {
    logger.error({
      event: 'auth-header-apikey-error',
      error: `[AiBots] Unexpected API key type: ${typeof apiKey}`,
      flowId: $.flow.id,
    })
    throw new Error('[AiBots] Missing API key')
  }

  // request config has headers by default already
  requestConfig.headers.set('X-ATLAS-Key', apiKey)
  requestConfig.baseURL = $.app.apiBaseUrl as string
  return requestConfig
}

export default addAuthHeader
