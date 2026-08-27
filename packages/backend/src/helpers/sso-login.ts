import { type Request, type Response } from 'express'
import { sign as signJwt, verify as verifyJwt } from 'jsonwebtoken'

import appConfig from '@/config/app'

import {
  SSO_LOGIN_COOKIE_NAME,
  SSO_LOGIN_COOKIE_TTL_SECONDS,
  type SsoLoginTransaction,
} from './sso-client'

export function sanitizeInternalPath(path: unknown): string | undefined {
  if (typeof path !== 'string') {
    return undefined
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return undefined
  }
  return path
}

export function setSsoLoginCookie(
  res: Response,
  transaction: SsoLoginTransaction,
): void {
  const token = signJwt(transaction, appConfig.sessionSecretKey, {
    expiresIn: SSO_LOGIN_COOKIE_TTL_SECONDS,
  })

  res.cookie(SSO_LOGIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !appConfig.isDev,
    maxAge: SSO_LOGIN_COOKIE_TTL_SECONDS * 1000,
  })
}

export function consumeSsoLoginCookie(
  req: Request,
  res: Response,
): SsoLoginTransaction | null {
  const token = req.cookies?.[SSO_LOGIN_COOKIE_NAME] as string | undefined
  res.clearCookie(SSO_LOGIN_COOKIE_NAME)

  if (!token) {
    return null
  }

  try {
    return verifyJwt(token, appConfig.sessionSecretKey) as SsoLoginTransaction
  } catch {
    return null
  }
}
