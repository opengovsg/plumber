import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

const TEST_SECRET = 'sample-app-secret-key'

vi.mock('@/config/app', () => ({
  default: {
    sessionSecretKey: TEST_SECRET,
    isDev: false,
  },
}))

describe('sso login cookie', () => {
  it('clears the cookie with the same SameSite and Secure flags used to set it', async () => {
    const { setSsoLoginCookie, consumeSsoLoginCookie } = await import(
      '../sso-login'
    )

    const res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as Response

    const transaction = {
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    }
    setSsoLoginCookie(res, transaction)

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
    }
    expect(res.cookie).toHaveBeenCalledWith(
      'plumber-sso-login',
      expect.any(String),
      expect.objectContaining(cookieOptions),
    )

    const token = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const req = {
      cookies: { 'plumber-sso-login': token },
    } as unknown as Request
    expect(consumeSsoLoginCookie(req, res)).toMatchObject(transaction)
    expect(res.clearCookie).toHaveBeenCalledWith(
      'plumber-sso-login',
      cookieOptions,
    )
  })
})
