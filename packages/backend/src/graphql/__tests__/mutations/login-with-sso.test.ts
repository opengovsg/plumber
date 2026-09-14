import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import loginWithSso from '@/graphql/mutations/login-with-sso'
import type User from '@/models/user'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  ssoCallback: vi.fn(),
  consumeSsoLoginCookie: vi.fn(),
  validateAndParseEmail: vi.fn(),
  setAuthCookie: vi.fn(),
  getOrCreateUser: vi.fn(),
  sendOnboardingEmail: vi.fn(),
  updateLastLogin: vi.fn(),
  logError: vi.fn(),
}))

const STUB_PARAMS = {
  input: {
    authCode: 'auth-code',
    state: 'csrf-state',
    iss: 'https://one.gov.sg/api/auth',
  },
}

const STUB_CONTEXT = {
  res: {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  },
  req: {
    cookies: {},
  },
} as unknown as Context

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/sso-client', () => ({
  ssoClient: {
    callback: mocks.ssoCallback,
  },
}))

vi.mock('@/helpers/sso-login', () => ({
  consumeSsoLoginCookie: mocks.consumeSsoLoginCookie,
}))

vi.mock('@/helpers/email-validator', () => ({
  validateAndParseEmail: mocks.validateAndParseEmail,
}))

vi.mock('@/helpers/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
  getOrCreateUser: mocks.getOrCreateUser,
  sendOnboardingEmail: mocks.sendOnboardingEmail,
  updateLastLogin: mocks.updateLastLogin,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

describe('Login with SSO', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs in officers who pass the existing RP allowlist', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.consumeSsoLoginCookie.mockReturnValueOnce({
      state: 'csrf-state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    })
    mocks.ssoCallback.mockResolvedValueOnce({
      sub: 'officer@agency.gov.sg',
      email: 'officer@agency.gov.sg',
    })
    mocks.validateAndParseEmail.mockResolvedValueOnce('officer@agency.gov.sg')
    mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'user-1' } as User)

    const result = await loginWithSso(null, STUB_PARAMS, STUB_CONTEXT)

    expect(mocks.ssoCallback).toHaveBeenCalledWith({
      code: 'auth-code',
      state: 'csrf-state',
      iss: 'https://one.gov.sg/api/auth',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    })
    expect(mocks.getOrCreateUser).toHaveBeenCalledWith('officer@agency.gov.sg')
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1',
      isSso: true,
    })
    expect(result).toBe(true)
  })

  it('returns 403 without creating a session when the RP allowlist rejects the email', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.consumeSsoLoginCookie.mockReturnValueOnce({
      state: 'csrf-state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    })
    mocks.ssoCallback.mockResolvedValueOnce({
      sub: 'outsider@example.com',
      email: 'outsider@example.com',
    })
    mocks.validateAndParseEmail.mockResolvedValueOnce(false)

    await expect(
      loginWithSso(null, STUB_PARAMS, STUB_CONTEXT),
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(mocks.getOrCreateUser).not.toHaveBeenCalled()
    expect(mocks.setAuthCookie).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
  })

  it('rejects reused or mismatched login transactions', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    mocks.consumeSsoLoginCookie.mockReturnValueOnce({
      state: 'other-state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    })

    await expect(loginWithSso(null, STUB_PARAMS, STUB_CONTEXT)).rejects.toThrow(
      'SSO login session is invalid or expired',
    )
    expect(mocks.ssoCallback).not.toHaveBeenCalled()
  })

  it('does not start SSO when the feature flag is off', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(false)

    await expect(loginWithSso(null, STUB_PARAMS, STUB_CONTEXT)).rejects.toThrow(
      'SSO is not enabled',
    )
    expect(mocks.consumeSsoLoginCookie).not.toHaveBeenCalled()
  })
})
