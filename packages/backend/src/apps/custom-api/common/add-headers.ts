import { IGlobalVariable, TBeforeRequest } from '@plumber/types'

import { InternalAxiosRequestConfig } from 'axios'

/**
 * The custom API action manually re-issues one redirect hop through this same
 * axios instance (see actions/http-request/index.ts), so this hook also runs
 * for the redirect target. Only forward the connection's auth headers if that
 * target is still on the origin the user configured, so a redirect to an
 * attacker-controlled host can't exfiltrate the connection's credentials.
 */
function isConfiguredOrigin(
  $: IGlobalVariable,
  requestConfig: InternalAxiosRequestConfig,
): boolean {
  const configuredUrl = $.step?.parameters?.url as string | undefined
  if (!configuredUrl || !requestConfig.baseURL) {
    return false
  }

  try {
    return (
      new URL(configuredUrl).origin === new URL(requestConfig.baseURL).origin
    )
  } catch {
    return false
  }
}

const addHeaders: TBeforeRequest = async ($, requestConfig) => {
  const authData = $.auth.data
  requestConfig.headers.set('Content-Type', 'application/json', false)

  if (authData?.headers && isConfiguredOrigin($, requestConfig)) {
    Object.entries(authData.headers).forEach(([key, value]) =>
      requestConfig.headers.set(key, value),
    )
  }

  return requestConfig
}

export default addHeaders
