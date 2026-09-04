import { Client, generators, Issuer, type TokenSet } from 'openid-client'

import appConfig from '@/config/app'

import logger from './logger'

export const SSO_LOGIN_COOKIE_NAME = 'plumber-sso-login'
export const SSO_LOGIN_COOKIE_TTL_SECONDS = 600
export const SSO_SCOPES = 'openid email'

export interface SsoLoginTransaction {
  state: string
  nonce: string
  codeVerifier: string
}

export interface SsoIdentity {
  sub: string
  email: string
}

const redirectUri = `${appConfig.webAppUrl}/login/sso/redirect`

function assertVerifiedIdentity(
  claims: ReturnType<TokenSet['claims']>,
  expectedIssuer: string,
): void {
  const requiredClaims = ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'] as const
  for (const claim of requiredClaims) {
    if (claims[claim] === undefined || claims[claim] === null) {
      throw new Error(`SSO id_token missing ${claim}`)
    }
  }

  if (claims.iss !== expectedIssuer) {
    throw new Error('SSO issuer mismatch')
  }

  const audience = claims.aud
  if (Array.isArray(audience)) {
    if (audience.length !== 1 || audience[0] !== appConfig.sso.clientId) {
      throw new Error('SSO audience mismatch')
    }
  } else if (audience !== appConfig.sso.clientId) {
    throw new Error('SSO audience mismatch')
  }
}

export class SsoClient {
  private client: Client | null = null
  private issuer: Issuer<Client> | null = null

  private async getClient(): Promise<Client> {
    if (!this.client) {
      this.issuer = await Issuer.discover(appConfig.sso.discoveryUrl)
      // one.gov.sg has no client secrets. openid-client signs a fresh
      // client assertion (unique jti, 60s exp) per token call.
      this.client = new this.issuer.Client(
        {
          client_id: appConfig.sso.clientId,
          redirect_uris: [redirectUri],
          response_types: ['code'],
          id_token_signed_response_alg: 'RS256',
          token_endpoint_auth_method: 'private_key_jwt',
          token_endpoint_auth_signing_alg: 'RS256',
        },
        { keys: [JSON.parse(appConfig.sso.privateKeyJwk)] },
      )
    }
    return this.client
  }

  async getDiscoveredIssuer(): Promise<string> {
    await this.getClient()
    const issuer = this.issuer?.metadata.issuer
    if (!issuer) {
      throw new Error('SSO issuer is not available')
    }
    return issuer
  }

  async createAuthorizationRequest(): Promise<{
    url: string
    transaction: SsoLoginTransaction
  }> {
    const client = await this.getClient()
    const state = generators.state()
    const nonce = generators.nonce()
    const codeVerifier = generators.codeVerifier()
    const codeChallenge = generators.codeChallenge(codeVerifier)

    const url = client.authorizationUrl({
      redirect_uri: redirectUri,
      scope: SSO_SCOPES,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
      state,
    })

    return {
      url,
      transaction: {
        state,
        nonce,
        codeVerifier,
      },
    }
  }

  async callback(params: {
    code: string
    state: string
    iss: string
    nonce: string
    codeVerifier: string
  }): Promise<SsoIdentity> {
    const client = await this.getClient()
    const expectedIssuer = this.issuer?.metadata.issuer

    if (!expectedIssuer || params.iss !== expectedIssuer) {
      throw new Error('SSO issuer mismatch')
    }

    try {
      const tokenSet = await client.callback(
        redirectUri,
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

      const claims = tokenSet.claims()
      assertVerifiedIdentity(claims, expectedIssuer)

      const email =
        typeof claims.email === 'string'
          ? claims.email.toLowerCase().trim()
          : ''
      if (!email) {
        throw new Error('SSO id_token missing email')
      }

      return {
        sub: claims.sub,
        email,
      }
    } catch (error) {
      logger.error('SSO: Unable to complete token exchange', {
        event: 'sso-login-failed-token-set',
      })
      throw error
    }
  }
}

export const ssoClient = new SsoClient()
