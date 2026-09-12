import { type Request, type Response } from 'express'
import { sign as signJwt, verify as verifyJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'

import {
  SSO_LOGIN_COOKIE_NAME,
  SSO_LOGIN_COOKIE_TTL_SECONDS,
  type SsoLoginTransaction,
} from './sso-client'

const ssoLoginCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: !appConfig.isDev,
}

export function setSsoLoginCookie(
  res: Response,
  transaction: SsoLoginTransaction,
): void {
  const token = signJwt(transaction, appConfig.sessionSecretKey, {
    expiresIn: SSO_LOGIN_COOKIE_TTL_SECONDS,
  })

  res.cookie(SSO_LOGIN_COOKIE_NAME, token, {
    ...ssoLoginCookieOptions,
    maxAge: SSO_LOGIN_COOKIE_TTL_SECONDS * 1000,
  })
}

export function consumeSsoLoginCookie(
  req: Request,
  res: Response,
): SsoLoginTransaction | null {
  const token = req.cookies?.[SSO_LOGIN_COOKIE_NAME] as string | undefined
  // Browsers ignore a delete unless SameSite and Secure match the original cookie.
  res.clearCookie(SSO_LOGIN_COOKIE_NAME, ssoLoginCookieOptions)

  if (!token) {
    return null
  }

  try {
    return verifyJwt(token, appConfig.sessionSecretKey) as SsoLoginTransaction
  } catch {
    return null
  }
}
