import { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import { getApiBaseUrl } from './api'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const { apiKey, paymentServiceId } = $.auth.data

  if (typeof apiKey !== 'string' || typeof paymentServiceId !== 'string') {
    logger.error({
      event: 'auth-header-apikey-error',
      error: `[PaySG] Unexpected API key type: ${typeof apiKey} and payment service ID type: ${typeof paymentServiceId}`,
      flowId: $.flow.id,
    })
    throw new Error('[PaySG] Missing API key or payment service ID')
  }

  const baseUrl = getApiBaseUrl(apiKey)

  if (!baseUrl) {
    logger.error({
      event: 'auth-header-baseurl-error',
      error: '[PaySG] No base URL obtained from API key',
      flowId: $.flow.id,
    })
    throw new Error('[PaySG] No base URL obtained from API key')
  }

  requestConfig.baseURL = baseUrl
  requestConfig.headers.set('x-api-key', apiKey)

  return requestConfig
}

export default addAuthHeader
