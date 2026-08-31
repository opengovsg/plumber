import { afterEach, describe, expect, it, vi } from 'vitest'

import startSsoLogin from '@/graphql/mutations/start-sso-login'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  getDiscoveredIssuer: vi.fn(),
  createAuthorizationRequest: vi.fn(),
  setSsoLoginCookie: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/sso-client', () => ({
  ssoClient: {
    createAuthorizationRequest: mocks.createAuthorizationRequest,
    getDiscoveredIssuer: mocks.getDiscoveredIssuer,
  },
}))

vi.mock('@/helpers/sso-login', () => ({
  setSsoLoginCookie: mocks.setSsoLoginCookie,
}))

const STUB_CONTEXT = {
  res: {
    cookie: vi.fn(),
  },
  req: {},
} as unknown as Context

describe('Start SSO login', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('stores the login transaction server-side and returns the authorize URL', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.createAuthorizationRequest.mockResolvedValueOnce({
      url: 'https://one.gov.sg/api/auth/oauth2/authorize?client_id=plumber',
      transaction: {
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      },
    })

    const result = await startSsoLogin(null, {}, STUB_CONTEXT)

    expect(mocks.createAuthorizationRequest).toHaveBeenCalledWith()
    expect(mocks.getDiscoveredIssuer).not.toHaveBeenCalled()
    expect(mocks.setSsoLoginCookie).toHaveBeenCalledWith(STUB_CONTEXT.res, {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    })
    expect(result).toEqual({
      authorizationUrl:
        'https://one.gov.sg/api/auth/oauth2/authorize?client_id=plumber',
    })
  })

  it('rejects initiate-login requests whose iss does not match discovery', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.getDiscoveredIssuer.mockResolvedValueOnce(
      'https://one.gov.sg/api/auth',
    )

    await expect(
      startSsoLogin(
        null,
        { input: { iss: 'https://one.gov.sg' } },
        STUB_CONTEXT,
      ),
    ).rejects.toThrow('SSO issuer mismatch')
    expect(mocks.createAuthorizationRequest).not.toHaveBeenCalled()
  })

  it('starts SSO when the initiate-login iss matches discovery', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.getDiscoveredIssuer.mockResolvedValueOnce(
      'https://one.gov.sg/api/auth',
    )
    mocks.createAuthorizationRequest.mockResolvedValueOnce({
      url: 'https://one.gov.sg/api/auth/oauth2/authorize?client_id=plumber',
      transaction: {
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      },
    })

    const result = await startSsoLogin(
      null,
      { input: { iss: 'https://one.gov.sg/api/auth' } },
      STUB_CONTEXT,
    )

    expect(result.authorizationUrl).toContain('oauth2/authorize')
    expect(mocks.setSsoLoginCookie).toHaveBeenCalled()
  })

  it('does not start SSO when the feature flag is off', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(false)

    await expect(startSsoLogin(null, {}, STUB_CONTEXT)).rejects.toThrow(
      'SSO is not enabled',
    )
    expect(mocks.createAuthorizationRequest).not.toHaveBeenCalled()
  })
})
