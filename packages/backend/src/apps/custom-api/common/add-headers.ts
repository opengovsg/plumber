import { TBeforeRequest } from '@plumber/types'

const addHeaders: TBeforeRequest = async ($, requestConfig) => {
  const authData = $.auth.data
  if (authData?.headers) {
    requestConfig.headers.set('Content-Type', 'application/json', true)
    Object.entries(authData.headers).forEach(([key, value]) =>
      requestConfig.headers.set(key, value),
    )
  }

  return requestConfig
}

export default addHeaders
