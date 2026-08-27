import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  authorizationUrl: vi.fn(),
  callback: vi.fn(),
  claims: vi.fn(),
  state: vi.fn(() => 'generated-state'),
  nonce: vi.fn(() => 'generated-nonce'),
  codeVerifier: vi.fn(() => 'generated-verifier'),
  codeChallenge: vi.fn(() => 'generated-challenge'),
}))

vi.mock('openid-client', () => {
  class Client {
    authorizationUrl = mocks.authorizationUrl
    callback = mocks.callback
  }

  class Issuer {
    Client = Client
    metadata = { issuer: 'https://one.gov.sg/api/auth' }
    static discover = mocks.discover
  }

  return {
    Issuer,
    generators: {
      state: mocks.state,
      nonce: mocks.nonce,
      codeVerifier: mocks.codeVerifier,
      codeChallenge: mocks.codeChallenge,
    },
  }
})

vi.mock('@/config/app', () => ({
  default: {
    webAppUrl: 'http://localhost:3001',
    isDev: true,
    sessionSecretKey: 'sample-app-secret-key',
    sso: {
      clientId: 'plumber-test',
      clientSecret: 'secret',
      discoveryUrl: 'https://one.gov.sg/api/auth',
    },
  },
}))

describe('SsoClient', () => {
  beforeEach(() => {
    mocks.discover.mockResolvedValue({
      metadata: { issuer: 'https://one.gov.sg/api/auth' },
      Client: function Client() {
        return {
          authorizationUrl: mocks.authorizationUrl,
          callback: mocks.callback,
        }
      },
    })
    mocks.authorizationUrl.mockReturnValue(
      'https://one.gov.sg/api/auth/oauth2/authorize?scope=openid%20email',
    )
    mocks.callback.mockResolvedValue({
      claims: mocks.claims,
    })
    mocks.claims.mockReturnValue({
      iss: 'https://one.gov.sg/api/auth',
      sub: 'officer@agency.gov.sg',
      aud: 'plumber-test',
      exp: 1,
      iat: 1,
      nonce: 'generated-nonce',
      email: 'officer@agency.gov.sg',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('builds the authorize URL from discovery with PKCE S256 and openid email', async () => {
    const { ssoClient } = await import('../sso-client')
    const result = await ssoClient.createAuthorizationRequest('/flows')

    expect(mocks.authorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'openid email',
        code_challenge_method: 'S256',
        code_challenge: 'generated-challenge',
        nonce: 'generated-nonce',
        state: 'generated-state',
      }),
    )
    expect(result.transaction).toEqual({
      state: 'generated-state',
      nonce: 'generated-nonce',
      codeVerifier: 'generated-verifier',
      redirect: '/flows',
    })
  })

  it('takes identity from the verified id_token and rejects issuer mismatches', async () => {
    const { ssoClient } = await import('../sso-client')
    await ssoClient.createAuthorizationRequest()

    const identity = await ssoClient.callback({
      code: 'code',
      state: 'generated-state',
      iss: 'https://one.gov.sg/api/auth',
      nonce: 'generated-nonce',
      codeVerifier: 'generated-verifier',
    })

    expect(identity).toEqual({
      sub: 'officer@agency.gov.sg',
      email: 'officer@agency.gov.sg',
    })

    await expect(
      ssoClient.callback({
        code: 'code',
        state: 'generated-state',
        iss: 'https://one.gov.sg',
        nonce: 'generated-nonce',
        codeVerifier: 'generated-verifier',
      }),
    ).rejects.toThrow('SSO issuer mismatch')
  })
})
