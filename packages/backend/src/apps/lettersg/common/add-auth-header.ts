import { TBeforeRequest } from '@plumber/types'

import { getApiBaseUrl } from './api'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const apiKey = $.auth.data.apiKey as string
  const baseUrl = getApiBaseUrl(apiKey)
  // request config has headers by default already
  requestConfig.headers['Authorization'] = `Bearer ${apiKey}`
  requestConfig.baseURL = baseUrl

  return requestConfig
}

export default addAuthHeader
