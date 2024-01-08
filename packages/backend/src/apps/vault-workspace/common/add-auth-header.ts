import { TBeforeRequest } from '@plumber/types'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  if (requestConfig.headers && $.auth.data?.apiKey) {
    requestConfig.headers['Authorization'] = `Bearer ${$.auth.data.apiKey}`
  }

  return requestConfig
}

export default addAuthHeader
