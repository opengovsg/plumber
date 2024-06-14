import type { TBeforeRequest } from '@plumber/types'

import appConfig from '@/config/app'
import { postmanSmsConfig } from '@/config/app-env-vars/postman-sms'

const POSTMAN_PROD_ENV_API_URL = 'https://postman.gov.sg/api/v2'
const POSTMAN_TEST_ENV_API_URL = 'https://test.postman.gov.sg/api/v2'

const addApiBaseUrl: TBeforeRequest = async ($, requestConfig) => {
  // For now, we'll determine which Postman env to use based on the current
  // Plumber env.
  //
  // Later on, when we add connection support, we'll determine the URL from auth
  // data (like our PaySG integration); this will enable users to add their
  // Postman test env campaigns on prod to test their pipes with.
  if (appConfig.isProd) {
    requestConfig.baseURL = POSTMAN_PROD_ENV_API_URL
  } else {
    requestConfig.baseURL = POSTMAN_TEST_ENV_API_URL
  }
  return requestConfig
}

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  requestConfig.headers.set(
    'Authorization',
    `Bearer ${postmanSmsConfig.defaultApiKey}`,
  )
  return requestConfig
}

export default [addApiBaseUrl, addAuthHeader]
