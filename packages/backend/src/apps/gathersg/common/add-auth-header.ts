import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import app from '..'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const apiKey = $.auth.data.apiKey

  if (typeof apiKey !== 'string') {
    logger.error({
      event: 'auth-header-apikey-error',
      error: `[Ownself Gather] Unexpected API key type: ${typeof apiKey}`,
      flowId: $.flow.id,
    })
    throw new Error('[Ownself Gather] Missing API key')
  }

  // request config has headers by default already
  requestConfig.headers.set('x-api-key', apiKey)
  requestConfig.baseURL = app.apiBaseUrl as string
  return requestConfig
}

export default addAuthHeader
