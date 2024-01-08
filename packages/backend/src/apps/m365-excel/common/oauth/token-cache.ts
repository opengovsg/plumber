import { Mutex } from 'async-mutex'

import {
  isM365TenantKey,
  M365TenantKey,
  m365TenantKeys,
} from '@/config/app-env-vars/m365'
import { type IHttpClient } from '@/helpers/http-client'

import {
  makeAccessTokenRequest,
  type MsGraphAccessToken,
} from './token-request'

interface CachedToken {
  mutex: Mutex // Non-blocking async mutex
  token: MsGraphAccessToken | null
}

const cachedTokens: Record<M365TenantKey, CachedToken> = Object.create(null)
for (const key of m365TenantKeys) {
  cachedTokens[key] = {
    mutex: new Mutex(),
    token: null,
  }
}

export async function getAccessToken(
  tenantKey: string,
  httpClient: IHttpClient,
): Promise<string> {
  if (!isM365TenantKey(tenantKey)) {
    throw new Error(`${tenantKey} is an invalid M365 tenant`)
  }
  const cachedToken = cachedTokens[tenantKey]

  if (Date.now() < cachedToken.token?.expiryTimestamp) {
    return cachedToken.token.value
  }

  // Slightly convoluted to avoid grabbing the mutex for every single request.
  await cachedToken.mutex.runExclusive(async () => {
    // If multiple requests await this callback, then the 1st request would
    // have grabbed a new token before resolving. This check makes later
    // requests avoid grabbing a token again.
    if (Date.now() < cachedToken.token?.expiryTimestamp) {
      return
    }

    // TODO (ogp-weeloong): use redis to reduce M365 API calls even further.
    cachedToken.token = await makeAccessTokenRequest(tenantKey, httpClient)
  })

  return cachedTokens[tenantKey].token.value
}
