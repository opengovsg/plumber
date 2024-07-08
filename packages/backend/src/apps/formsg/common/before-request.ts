import type { TBeforeRequest } from '@plumber/types'

import { getApiBaseUrl, parseFormEnv } from './form-env'

const addApiBaseUrl: TBeforeRequest = async ($, requestConfig) => {
  const env = parseFormEnv($)
  requestConfig.baseURL = getApiBaseUrl(env)
  return requestConfig
}

export default [addApiBaseUrl]
