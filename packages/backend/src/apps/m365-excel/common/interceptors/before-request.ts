import type { TBeforeRequest } from '@plumber/types'

import { MS_GRAPH_OAUTH_BASE_URL } from '../constants'
import { getAccessToken } from '../oauth/token-cache'

// TODO in later PR: usage tracker

const addAuthToken: TBeforeRequest = async function ($, requestConfig) {
  // Don't add token if we're trying to request a token.
  if (requestConfig.baseURL === MS_GRAPH_OAUTH_BASE_URL) {
    return requestConfig
  }

  // getAccessToken immediately resolves if token is valid, or renews the token
  // _exactly once_ if needed. So we can call it before each request without any
  // concerns to keep request logic simple.
  $.auth.data.accessToken = await getAccessToken(
    $.auth.data?.tenantKey as string,
    $.http,
  )

  requestConfig.headers.set(
    'Authorization',
    `Bearer ${$.auth.data.accessToken}`,
  )

  return requestConfig
}

// TODO in later PR: rate limiting request interceptor (this is temporary
// until we implement the plumber-wide rate limiting system; building this
// first to unblock M365 pilot).

export default [addAuthToken]
