import { randomUUID } from 'crypto'
import FormData from 'form-data'
import jwt from 'jsonwebtoken'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'
import type { IHttpClient } from '@/helpers/http-client'

import { MS_GRAPH_OAUTH_BASE_URL } from '../constants'

export interface MsGraphAccessToken {
  value: string
  requestTimestamp: number
  expiryTimestamp: number
}

// https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
function makeClientAssertion(tenant: M365TenantInfo): string {
  const currTimeSeconds = Math.round(Date.now() / 1000)

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    x5t: Buffer.from(tenant.clientThumbprint, 'hex').toString('base64url'),
  }
  const payload = {
    jti: randomUUID(),

    aud: `${MS_GRAPH_OAUTH_BASE_URL}/${tenant.id}/oauth2/v2.0/token`,
    iss: tenant.clientId,
    sub: tenant.clientId,

    iat: currTimeSeconds,
    nbf: currTimeSeconds,
    exp: currTimeSeconds + 600, // 10 minutes
  }

  return jwt.sign(payload, tenant.clientPrivateKey, { header })
}

interface RawMsGraphAccessTokenResponse {
  token_type: string
  expires_in: number
  access_token: string
}

// https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow
export async function makeAccessTokenRequest(
  tenantKey: string,
  httpClient: IHttpClient,
): Promise<MsGraphAccessToken> {
  const tenant = getM365TenantInfo(tenantKey)

  const requestTimestamp = Date.now()
  const body = new FormData()
  body.append('client_id', tenant.clientId)
  body.append('scope', 'https://graph.microsoft.com/.default')
  body.append(
    'client_assertion_type',
    'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  )
  body.append('client_assertion', makeClientAssertion(tenant))
  body.append('grant_type', 'client_credentials')

  const response = await httpClient.post<RawMsGraphAccessTokenResponse>(
    `/${tenant.id}/oauth2/v2.0/token`,
    body,
    {
      // Our http-client is already instantiated with MS Graph's base URL, but
      // MS uses a different URL for auth, so we override it here.
      baseURL: MS_GRAPH_OAUTH_BASE_URL,
      headers: body.getHeaders(),
    },
  )

  if (!response?.data?.access_token) {
    throw new Error('Access token is missing from MS auth response')
  }
  if (!response?.data?.expires_in) {
    throw new Error('Access token expiry is missing from MS auth response')
  }

  return {
    value: response.data.access_token,
    requestTimestamp,
    expiryTimestamp:
      requestTimestamp +
      // requestTimestamp is in milliseconds, but expires_in is in seconds
      Number(response.data.expires_in) * 1000,
  }
}
