import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import { getApiBaseUrl } from './api'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const apiKey = $.auth.data.apiKey

  if (typeof apiKey !== 'string') {
    logger.error({
      event: 'auth-header-apikey-error',
      error: 'LetterSG: API key must be set',
      flowId: $.flow.id,
    })
    throw new Error('Missing API key')
  }

  const baseUrl = getApiBaseUrl(apiKey)

  if (!baseUrl) {
    logger.error({
      event: 'auth-header-baseurl-error',
      error: 'LetterSG: No base URL obtained from API key',
      flowId: $.flow.id,
    })
    throw new Error('No base URL obtained from API key')
  }

  // request config has headers by default already
  requestConfig.headers.set('Authorization', `Bearer ${apiKey}`)
  requestConfig.baseURL = baseUrl
  return requestConfig
}

export default addAuthHeader
