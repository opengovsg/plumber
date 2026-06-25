import axios from 'axios'
import { Request, Response } from 'express'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'

import appConfig from '@/config/app'
import BaseError from '@/errors/base'
import User from '@/models/user'

import logger from './logger'

const AUTH_COOKIE_NAME = 'plumber.sid'
// 3 days expiry
const TOKEN_EXPIRES_IN_SEC = 3 * 24 * 60 * 60
const ONBOARDING_EMAIL_RELEASE_DATE = new Date('2025-03-10')

interface AuthCookiePayload {
  userId: string
  isSso?: boolean
}

export function setAuthCookie(res: Response, payload: AuthCookiePayload): void {
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

export function getParsedAuthCookie(req: Request) {
  const token = getAuthCookie(req)
  if (!token) {
    return null
  }
  return jwt.verify(token, appConfig.sessionSecretKey) as {
    userId: string
    isSso?: boolean
  }
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
  } catch {
    return null
  }
}

export function deleteAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME)
}

// TEMPORARY: block new sign-ups from these domains while a migration is in
// progress. Existing users with these domains are unaffected. Remove after the
// migration date (7th July 2026).
const BLOCKED_SIGNUP_DOMAINS = ['swda.gov.sg']

export async function getOrCreateUser(email: string): Promise<User> {
  email = email.trim().toLowerCase()

  let user = await User.query().findOne({ email })
  if (!user) {
    const domain = email.split('@')[1]
    if (BLOCKED_SIGNUP_DOMAINS.includes(domain)) {
      throw new BaseError(
        'New accounts with swda email domain are prohibited till 7th July 2026 as we will perform a migration for you.',
      )
    }
    user = await User.query().insertAndFetch({ email })
  }

  return user
}

export async function sendOnboardingEmail(user: User) {
  // check if user has logged in before and has been created
  // after the specified date for the release of onboarding email
  if (
    user.lastLoginAt !== null ||
    new Date(user.createdAt) < ONBOARDING_EMAIL_RELEASE_DATE
  ) {
    return
  }
  // call plumber webhook to send onboarding email only in prod
  try {
    if (appConfig.isProd && appConfig.onboardingEmailWebhookUrl) {
      await axios.post(appConfig.onboardingEmailWebhookUrl, {
        email: user.email,
      })
    }
  } catch (error) {
    logger.error({
      event: 'onboarding-email-error',
      error: error.message,
    })
  }
}

export async function updateLastLogin(id: string) {
  if (!id) {
    throw new Error('User id required!')
  }

  const updatedRows = await User.query()
    .patch({
      lastLoginAt: new Date(),
    })
    .where({ id })

  if (!updatedRows) {
    throw new Error('No user found')
  }
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
