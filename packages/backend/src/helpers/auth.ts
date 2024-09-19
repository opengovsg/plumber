import { Request, Response } from 'express'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID } from '@/db/storage/demo-send-notifications'
import User from '@/models/user'

import { createDemoFlowFromTemplate } from './flow-templates'

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
    // default demo template is formsg-postman
    await createDemoFlowFromTemplate(
      SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID,
      user,
      true,
    )
  }

  return user
}

// Admin tokens are more sensitive so we set a low max age of 5 min
const ADMIN_TOKEN_MAX_AGE_SEC = 5 * 60

export interface AdminToken {
  userEmail?: string | null
}

export function parseAdminToken(token: string): AdminToken | null {
  try {
    // NOTE: we use a different key to prevent a vuln where an end user can send
    // their auth cookie in the `x-plumber-admin-token` header value to gain
    // admin access.
    return jwt.verify(token, appConfig.adminJwtSecretKey, {
      maxAge: ADMIN_TOKEN_MAX_AGE_SEC,
    }) as AdminToken
  } catch (err) {
    if (!(err instanceof JsonWebTokenError)) {
      throw err
    }

    return null
  }
}

export async function getAdminTokenUser({
  userEmail,
}: AdminToken): Promise<User | null> {
  // Some admin operations may be run in user-less context so userEmail can be
  // null.
  if (!userEmail) {
    return null
  }

  return User.query().where('email', userEmail).first().throwIfNotFound()
}
