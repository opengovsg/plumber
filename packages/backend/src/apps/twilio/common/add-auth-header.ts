import { TBeforeRequest } from '@plumber/types'

const addAuthHeader: TBeforeRequest = async ($, requestConfig) => {
  const username = ($.auth.data.apiKeySid || $.auth.data.accountSid) as string
  const password = $.auth.data.authToken as string
  if (requestConfig.headers && username && password) {
    requestConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded'

    requestConfig.auth = {
      username,
      password,
    }
  }

  return requestConfig
}

export default addAuthHeader
