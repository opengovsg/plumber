import { afterEach, describe, expect, it, vi } from 'vitest'

import startSsoLogin from '@/graphql/mutations/start-sso-login'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  createAuthorizationRequest: vi.fn(),
  setSsoLoginCookie: vi.fn(),
  sanitizeInternalPath: vi.fn((path: unknown) =>
    typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
      ? path
      : undefined,
  ),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/sso-client', () => ({
  ssoClient: {
    createAuthorizationRequest: mocks.createAuthorizationRequest,
  },
}))

vi.mock('@/helpers/sso-login', () => ({
  setSsoLoginCookie: mocks.setSsoLoginCookie,
  sanitizeInternalPath: mocks.sanitizeInternalPath,
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
        redirect: '/flows',
      },
    })

    const result = await startSsoLogin(
      null,
      { input: { redirect: '/flows' } },
      STUB_CONTEXT,
    )

    expect(mocks.createAuthorizationRequest).toHaveBeenCalledWith('/flows')
    expect(mocks.setSsoLoginCookie).toHaveBeenCalledWith(STUB_CONTEXT.res, {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
      redirect: '/flows',
    })
    expect(result).toEqual({
      authorizationUrl:
        'https://one.gov.sg/api/auth/oauth2/authorize?client_id=plumber',
    })
  })

  it('does not start SSO when the feature flag is off', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(false)

    await expect(
      startSsoLogin(null, { input: {} }, STUB_CONTEXT),
    ).rejects.toThrow('SSO is not enabled')
    expect(mocks.createAuthorizationRequest).not.toHaveBeenCalled()
  })
})
