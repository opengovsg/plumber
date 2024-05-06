import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import appConfig from '@/config/app'
import User from '@/models/user'

const AUTH_COOKIE_NAME = 'plumber.sid'
// 3 days expiry
const TOKEN_EXPIRES_IN_SEC = 3 * 24 * 60 * 60

export function setAuthCookie(
  res: Response,
  payload: { userId: string },
): void {
  // create jwt
  const token = jwt.sign(payload, appConfig.sessionSecretKey, {
    expiresIn: TOKEN_EXPIRES_IN_SEC,
  })

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: !appConfig.isDev,
    maxAge: 1000 * TOKEN_EXPIRES_IN_SEC, // 3 days expressed in milliseconds
  })
  return
}

function getAuthCookie(req: Request) {
  return req.cookies[AUTH_COOKIE_NAME]
}

export async function getLoggedInUser(req: Request): Promise<User | null> {
  const token = getAuthCookie(req)
  if (!token) {
    return null
  }

  try {
    const { userId } = jwt.verify(token, appConfig.sessionSecretKey) as {
      userId: string
    }
    return User.query().findById(userId)
  } catch (err) {
    return null
  }
}

export function deleteAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME)
}

export async function getOrCreateUser(email: string): Promise<User> {
  email = email.trim().toLowerCase()

  let user = await User.query().findOne({ email })
  if (!user) {
    user = await User.query().insertAndFetch({ email })
  }

  return user
}
