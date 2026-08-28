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
  httpOptions: vi.fn((_url: unknown, options: unknown) => options),
  httpOptionsKey: Symbol('http_options'),
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
    custom: {
      http_options: mocks.httpOptionsKey,
    },
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
          [mocks.httpOptionsKey]: undefined,
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
    const result = await ssoClient.createAuthorizationRequest()

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
    })
  })

  it('passes nonce, state, and code_verifier checks to client.callback', async () => {
    const { ssoClient } = await import('../sso-client')
    await ssoClient.createAuthorizationRequest()

    await ssoClient.callback({
      code: 'code',
      state: 'generated-state',
      iss: 'https://one.gov.sg/api/auth',
      nonce: 'generated-nonce',
      codeVerifier: 'generated-verifier',
    })

    expect(mocks.callback).toHaveBeenCalledWith(
      'http://localhost:3001/login/sso/redirect',
      {
        code: 'code',
        state: 'generated-state',
        iss: 'https://one.gov.sg/api/auth',
      },
      {
        nonce: 'generated-nonce',
        state: 'generated-state',
        code_verifier: 'generated-verifier',
        response_type: 'code',
      },
    )
  })

  it('takes identity from the verified id_token and rejects query iss mismatches', async () => {
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

  it('rejects when id_token claims.iss does not match the discovered issuer', async () => {
    mocks.claims.mockReturnValue({
      iss: 'https://evil.example/auth',
      sub: 'officer@agency.gov.sg',
      aud: 'plumber-test',
      exp: 1,
      iat: 1,
      nonce: 'generated-nonce',
      email: 'officer@agency.gov.sg',
    })

    const { ssoClient } = await import('../sso-client')
    await ssoClient.createAuthorizationRequest()

    await expect(
      ssoClient.callback({
        code: 'code',
        state: 'generated-state',
        iss: 'https://one.gov.sg/api/auth',
        nonce: 'generated-nonce',
        codeVerifier: 'generated-verifier',
      }),
    ).rejects.toThrow('SSO issuer mismatch')
  })

  it('rejects multi-audience id_tokens', async () => {
    mocks.claims.mockReturnValue({
      iss: 'https://one.gov.sg/api/auth',
      sub: 'officer@agency.gov.sg',
      aud: ['plumber-test', 'another-client'],
      exp: 1,
      iat: 1,
      nonce: 'generated-nonce',
      email: 'officer@agency.gov.sg',
    })

    const { ssoClient } = await import('../sso-client')
    await ssoClient.createAuthorizationRequest()

    await expect(
      ssoClient.callback({
        code: 'code',
        state: 'generated-state',
        iss: 'https://one.gov.sg/api/auth',
        nonce: 'generated-nonce',
        codeVerifier: 'generated-verifier',
      }),
    ).rejects.toThrow('SSO audience mismatch')
  })

  it('rejects blank email claims', async () => {
    mocks.claims.mockReturnValue({
      iss: 'https://one.gov.sg/api/auth',
      sub: 'officer@agency.gov.sg',
      aud: 'plumber-test',
      exp: 1,
      iat: 1,
      nonce: 'generated-nonce',
      email: '   ',
    })

    const { ssoClient } = await import('../sso-client')
    await ssoClient.createAuthorizationRequest()

    await expect(
      ssoClient.callback({
        code: 'code',
        state: 'generated-state',
        iss: 'https://one.gov.sg/api/auth',
        nonce: 'generated-nonce',
        codeVerifier: 'generated-verifier',
      }),
    ).rejects.toThrow('SSO id_token missing email')
  })
})
