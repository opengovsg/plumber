import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  getLdFlagValue: vi.fn(),
  authorizationUrl: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  storeSsoLoginTransaction: vi.fn(),
  consumeSsoLoginTransaction: vi.fn(),
  createSsoTransactionId: vi.fn(() => 'tx-1'),
  getOrCreateUser: vi.fn(),
  sendOnboardingEmail: vi.fn(),
  setAuthCookie: vi.fn(),
  updateLastLogin: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('rate-limiter-flexible', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rate-limiter-flexible')>()
  return {
    ...actual,
    RateLimiterRedis: vi.fn(function () {
      return { consume: mocks.consumeRateLimit }
    }),
  }
})

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))

vi.mock('@/config/app', () => ({
  default: {
    isDev: true,
    webAppUrl: 'http://localhost:3001',
    sso: {
      clientId: 'plumber-local',
      privateKeyPem: 'pem',
      discoveryUrl: 'https://one.gov.sg/api/auth',
    },
  },
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/sso-client', () => ({
  ssoIssuer: 'https://one.gov.sg/api/auth',
  ssoClient: {
    authorizationUrl: mocks.authorizationUrl,
    exchangeAuthorizationCode: mocks.exchangeAuthorizationCode,
  },
}))

vi.mock('@/helpers/sso-login-transaction', () => ({
  SSO_TRANSACTION_COOKIE_NAME: 'plumber.sso.tx',
  SSO_TRANSACTION_TTL_SECONDS: 600,
  createSsoTransactionId: mocks.createSsoTransactionId,
  storeSsoLoginTransaction: mocks.storeSsoLoginTransaction,
  consumeSsoLoginTransaction: mocks.consumeSsoLoginTransaction,
}))

vi.mock('@/helpers/auth', () => ({
  getOrCreateUser: mocks.getOrCreateUser,
  sendOnboardingEmail: mocks.sendOnboardingEmail,
  setAuthCookie: mocks.setAuthCookie,
  updateLastLogin: mocks.updateLastLogin,
}))

vi.mock('@/helpers/logger', () => ({
  default: mocks.logger,
}))

import { handleSsoCallback, startSsoLogin } from '../sso'

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    headersSent: false,
  }
}

describe('SSO routes', () => {
  beforeEach(() => {
    mocks.consumeRateLimit.mockResolvedValue({})
    mocks.getLdFlagValue.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startSsoLogin', () => {
    it('rejects an attacker-supplied iss', async () => {
      const req = {
        query: { iss: 'https://evil.example' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await startSsoLogin(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mocks.authorizationUrl).not.toHaveBeenCalled()
    })

    it('starts a login when iss is absent', async () => {
      mocks.authorizationUrl.mockResolvedValueOnce({
        authorizationUrl: 'https://one.gov.sg/api/auth/oauth2/authorize?x=1',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'a'.repeat(43),
      })
      const req = {
        query: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await startSsoLogin(req, res)

      expect(mocks.storeSsoLoginTransaction).toHaveBeenCalled()
      expect(res.cookie).toHaveBeenCalledWith(
        'plumber.sso.tx',
        'tx-1',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      )
      expect(res.redirect).toHaveBeenCalledWith(
        303,
        'https://one.gov.sg/api/auth/oauth2/authorize?x=1',
      )
    })

    it('starts a login when iss matches the configured issuer', async () => {
      mocks.authorizationUrl.mockResolvedValueOnce({
        authorizationUrl: 'https://one.gov.sg/api/auth/oauth2/authorize?x=1',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'a'.repeat(43),
      })
      const req = {
        query: { iss: 'https://one.gov.sg/api/auth' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await startSsoLogin(req, res)

      expect(res.redirect).toHaveBeenCalledWith(
        303,
        'https://one.gov.sg/api/auth/oauth2/authorize?x=1',
      )
    })
  })

  describe('handleSsoCallback', () => {
    const stored = {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'a'.repeat(43),
    }

    it('returns 400 when the transaction is missing', async () => {
      const req = {
        cookies: {},
        query: {},
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await handleSsoCallback(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mocks.exchangeAuthorizationCode).not.toHaveBeenCalled()
    })

    it('does not exchange a code when state does not match', async () => {
      mocks.consumeSsoLoginTransaction.mockResolvedValueOnce(stored)
      const req = {
        cookies: { 'plumber.sso.tx': 'tx-1' },
        query: {
          state: 'other',
          iss: 'https://one.gov.sg/api/auth',
          code: 'abc',
        },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await handleSsoCallback(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mocks.exchangeAuthorizationCode).not.toHaveBeenCalled()
    })

    it('sends unauthorized officers to the 403 page without creating a session', async () => {
      mocks.consumeSsoLoginTransaction.mockResolvedValueOnce(stored)
      mocks.exchangeAuthorizationCode.mockResolvedValueOnce({
        sub: 'officer@agency.gov.sg',
        email: 'officer@agency.gov.sg',
        sid: 'sid-1',
      })
      const req = {
        cookies: { 'plumber.sso.tx': 'tx-1' },
        query: {
          state: 'state',
          iss: 'https://one.gov.sg/api/auth',
          code: 'abc',
        },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await handleSsoCallback(req, res)

      expect(mocks.setAuthCookie).not.toHaveBeenCalled()
      expect(mocks.getOrCreateUser).not.toHaveBeenCalled()
      expect(res.redirect).toHaveBeenCalledWith(
        303,
        'http://localhost:3001/login/sso/unauthorized',
      )
    })

    it('creates a session for an allowed officer and stores sid', async () => {
      mocks.consumeSsoLoginTransaction.mockResolvedValueOnce(stored)
      mocks.exchangeAuthorizationCode.mockResolvedValueOnce({
        sub: 'officer@open.gov.sg',
        email: 'officer@open.gov.sg',
        sid: 'sid-1',
      })
      mocks.getOrCreateUser.mockResolvedValueOnce({ id: 'user-1' })
      const req = {
        cookies: { 'plumber.sso.tx': 'tx-1' },
        query: {
          state: 'state',
          iss: 'https://one.gov.sg/api/auth',
          code: 'abc',
        },
      } as unknown as Request
      const res = mockRes() as unknown as Response

      await handleSsoCallback(req, res)

      expect(mocks.setAuthCookie).toHaveBeenCalledWith(res, {
        userId: 'user-1',
        isSso: true,
        ssoSid: 'sid-1',
      })
      expect(res.redirect).toHaveBeenCalledWith(
        303,
        'http://localhost:3001/flows',
      )
    })
  })
})
