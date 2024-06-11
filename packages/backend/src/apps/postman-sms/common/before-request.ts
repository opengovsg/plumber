import type { TBeforeRequest } from '@plumber/types'

import { authDataSchema } from '../auth/schema'

import { PostmanEnv, PROD_ENV_API_URL, TEST_ENV_API_URL } from './constants'
import getPostmanEnv from './get-postman-env'

const addApiBaseUrl: TBeforeRequest = async ($, requestConfig) => {
  switch (getPostmanEnv($)) {
    case PostmanEnv.Prod:
      requestConfig.baseURL = PROD_ENV_API_URL
      break
    case PostmanEnv.Test:
      requestConfig.baseURL = TEST_ENV_API_URL
      break
  }

  return requestConfig
}

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const { apiKey } = authDataSchema.parse($.auth.data)
  requestConfig.headers.set('Authorization', `Bearer ${apiKey}`)
  return requestConfig
}

export default [addApiBaseUrl, addAuthHeader]
