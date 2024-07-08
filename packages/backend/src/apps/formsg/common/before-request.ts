import type { TBeforeRequest } from '@plumber/types'

import { getApiBaseUrl, parseFormEnv } from './form-env'

const addApiBaseUrl: TBeforeRequest = async ($, requestConfig) => {
  requestConfig.baseURL = getApiBaseUrl(parseFormEnv($))
  return requestConfig
}

export default [addApiBaseUrl]
