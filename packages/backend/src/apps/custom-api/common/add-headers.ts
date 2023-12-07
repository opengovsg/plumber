import { TBeforeRequest } from '@plumber/types'

const addHeaders: TBeforeRequest = ($, requestConfig) => {
  const authData = $.auth.data
  if (authData?.headers) {
    requestConfig.headers['Content-Type'] = 'application/json'
    Object.entries(authData.headers).forEach(([key, value]) =>
      requestConfig.headers.set(key, value),
    )
  }

  return requestConfig
}

export default addHeaders
