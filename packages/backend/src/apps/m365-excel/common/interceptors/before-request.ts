import type { TBeforeRequest } from '@plumber/types'

import logger from '@/helpers/logger'

import { MS_GRAPH_OAUTH_BASE_URL } from '../constants'
import { getAccessToken } from '../oauth/token-cache'

// This explicitly overcounts - e.g we will log if the request times out, even
// we can't confirm that it reached Microsoft. The intent is to assume the worst
// case scenario and not miss cases such as:
// 1. We sent a request and it reached Microsoft.
// 2. Microsoft responds; response is routed by various routers on the net.
// 3. One of the routers in the response trip crashes and we get a timeout.
const usageTracker: TBeforeRequest = async function (_$, requestConfig) {
  logger.info('Making request to MS Graph', {
    event: 'm365-ms-graph-request',
    baseUrl: requestConfig.baseURL, // base URL is different for auth requests
    urlPath: requestConfig.url,
  })

  return requestConfig
}

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

export default [usageTracker, addAuthToken]
