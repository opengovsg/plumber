import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import { getApiBaseUrl } from './api'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const { apiKey, paymentServiceId } = $.auth.data

  if (typeof apiKey !== 'string' || typeof paymentServiceId !== 'string') {
    logger.error({
      event: 'auth-header-apikey-error',
      error: 'PaySG: API key and payment service ID must be set',
      flowId: $.flow.id,
    })
    throw new Error('Missing API key or payment service ID')
  }

  const baseUrl = getApiBaseUrl(apiKey)

  if (!baseUrl) {
    logger.error({
      event: 'auth-header-baseurl-error',
      error: 'PaySG: No base URL obtained from API key',
      flowId: $.flow.id,
    })
    throw new Error('No base URL obtained from API key')
  }

  requestConfig.baseURL = baseUrl
  requestConfig.headers.set('x-api-key', apiKey)

  return requestConfig
}

export default addAuthHeader
