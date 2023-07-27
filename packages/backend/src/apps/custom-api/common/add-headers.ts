import { TBeforeRequest } from '@plumber/types'

const addHeaders: TBeforeRequest = ($, requestConfig) => {
  const authData = $.auth.data
  if (authData?.headers) {
    requestConfig.headers = {
      ...requestConfig.headers,
      'Content-Type': 'application/json',
      ...(authData.headers as Record<string, string>),
    }
  }

  return requestConfig
}

export default addHeaders
