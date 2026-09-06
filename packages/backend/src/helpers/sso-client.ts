import { Client, custom, generators, Issuer } from 'openid-client'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'
import {
  expectedIssuerFromDiscoveryUrl,
  pemToPrivateJwks,
} from '@/helpers/sso-config'
import {
  assertVerifiedIdTokenClaims,
  type VerifiedSsoClaims,
} from '@/helpers/sso-id-token'

const DISCOVERY_TIMEOUT_MS = 5000
const ID_TOKEN_CLOCK_TOLERANCE_SECONDS = 60
const SSO_SCOPE = 'openid email'

export const ssoRedirectUri = `${appConfig.webAppUrl}/api/login/sso/callback`
export const ssoIssuer = expectedIssuerFromDiscoveryUrl(
  appConfig.sso.discoveryUrl,
)

export type SsoAuthorizationRequest = {
  authorizationUrl: string
  state: string
  nonce: string
  codeVerifier: string
}

Issuer[custom.http_options] = (_url, options) => ({
  ...options,
  timeout: DISCOVERY_TIMEOUT_MS,
  followRedirect: false,
})

export class SsoClient {
  private client: Client | null = null

  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client
    }

    try {
      const issuer = await Issuer.discover(appConfig.sso.discoveryUrl)
      if (issuer.metadata.issuer !== ssoIssuer) {
        throw new Error('SSO discovery issuer mismatch')
      }
      if (
        !issuer.metadata.authorization_endpoint ||
        !issuer.metadata.token_endpoint ||
        !issuer.metadata.jwks_uri
      ) {
        throw new Error('SSO discovery document is missing endpoints')
      }

      const client = new issuer.Client(
        {
          client_id: appConfig.sso.clientId,
          token_endpoint_auth_method: 'private_key_jwt',
          token_endpoint_auth_signing_alg: 'RS256',
          id_token_signed_response_alg: 'RS256',
          redirect_uris: [ssoRedirectUri],
          response_types: ['code'],
        },
        pemToPrivateJwks(appConfig.sso.privateKeyPem),
      )
      client[custom.clock_tolerance] = ID_TOKEN_CLOCK_TOLERANCE_SECONDS
      this.client = client
      return client
    } catch (error) {
      this.client = null
      throw error
    }
  }

  async authorizationUrl(): Promise<SsoAuthorizationRequest> {
    const client = await this.getClient()
    const codeVerifier = generators.codeVerifier()
    const state = generators.state()
    const nonce = generators.nonce()

    const authorizationUrl = client.authorizationUrl({
      redirect_uri: ssoRedirectUri,
      scope: SSO_SCOPE,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
      response_type: 'code',
    })

    return {
      authorizationUrl,
      state,
      nonce,
      codeVerifier,
    }
  }

  async exchangeAuthorizationCode(params: {
    code: string
    state: string
    iss: string
    nonce: string
    codeVerifier: string
  }): Promise<VerifiedSsoClaims> {
    const client = await this.getClient()

    try {
      const tokenSet = await client.callback(
        ssoRedirectUri,
        {
          code: params.code,
          state: params.state,
          iss: params.iss,
        },
        {
          nonce: params.nonce,
          state: params.state,
          code_verifier: params.codeVerifier,
          response_type: 'code',
        },
      )

      return assertVerifiedIdTokenClaims({
        claims: tokenSet.claims() as unknown as Record<string, unknown>,
        issuer: ssoIssuer,
        clientId: appConfig.sso.clientId,
        nonce: params.nonce,
      })
    } catch (error) {
      logger.error('SSO token exchange failed', {
        event: 'sso-login-failed-token-set',
      })
      throw error
    }
  }
}

export const ssoClient = new SsoClient()
