import type { TBeforeRequest } from '@plumber/types'

import { RateLimiterRes } from 'rate-limiter-flexible'

import { isM365TenantKey } from '@/config/app-env-vars/m365'
import RetriableError from '@/errors/retriable-error'
import logger from '@/helpers/logger'

import { MS_GRAPH_OAUTH_BASE_URL } from '../constants'
import { getAccessToken } from '../oauth/token-cache'
import { consumeOrThrowLimiterWithLongestDelay } from '../rate-limiter'

// This explicitly overcounts - e.g we will log if the request times out, even
// we can't confirm that it reached Microsoft. The intent is to assume the worst
// case scenario and not miss cases such as:
// 1. We sent a request and it reached Microsoft.
// 2. Microsoft responds; response is routed by various routers on the net.
// 3. One of the routers in the response trip crashes and we get a timeout.
const usageTracker: TBeforeRequest = async function ($, requestConfig) {
  logger.info('Making request to MS Graph', {
    event: 'm365-ms-graph-request',
    tenant: $.auth.data?.tenantKey as string,
    baseUrl: requestConfig.baseURL, // base URL is different for auth requests
    urlPath: requestConfig.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
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

// This rate limiting request interceptor is slightly different from the planned
// plumber-wide rate limiting system; we need to limit per request instead of
// per action (that's also why this is placed in beforeRequest instead of in the
// `run` function; an action may need multiple requests).
const rateLimitCheck: TBeforeRequest = async function ($, requestConfig) {
  const tenantKey = $.auth.data?.tenantKey as string
  if (!isM365TenantKey(tenantKey)) {
    throw new Error(`'${tenantKey}' is not a valid M365 tenant.`)
  }

  try {
    await consumeOrThrowLimiterWithLongestDelay($, tenantKey, 1)
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) {
      return
    }

    throw new RetriableError({
      error: 'Reached M365 rate limit',
      delayInMs: error.msBeforeNext,
    })
  }

  return requestConfig
}

// rateLimitCheck are explicitly the earliest interceptors so that the others
// are not called if it throws an error.
export default [rateLimitCheck, usageTracker, addAuthToken]
