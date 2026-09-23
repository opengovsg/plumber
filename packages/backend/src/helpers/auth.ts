import axios from 'axios'
import { createHash } from 'crypto'
import { Request, Response } from 'express'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'

import appConfig from '@/config/app'
import { BLOCK_NEW_LOGINS_FLAG } from '@/config/flags'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import BaseError from '@/errors/base'
import User from '@/models/user'

import { getLdFlagValue } from './launch-darkly'
import logger from './logger'

const AUTH_COOKIE_NAME = 'plumber.sid'
// 3 days expiry
const TOKEN_EXPIRES_IN_SEC = 3 * 24 * 60 * 60
const ONBOARDING_EMAIL_RELEASE_DATE = new Date('2025-03-10')

// The auth cookie is a self-contained JWT, not a server-side session, so
// logout can't destroy anything server-side by default. This denylist lets
// us reject a specific token before its natural expiry; entries are keyed by
// hash (never the raw token) and TTLed to the token's remaining lifetime so
// they clean themselves up.
//
// commandTimeout bounds how long a lookup/write can block: this client sits
// on the request path (every authenticated request checks it), so a Redis
// outage must fail fast into the catch blocks below rather than hang
// requests forever (the default client config waits indefinitely).
const AUTH_DENYLIST_COMMAND_TIMEOUT_MS = 3_000
const authTokenDenylistClient = createRedisClient(
  REDIS_DB_INDEX.AUTH_TOKEN_DENYLIST,
  { commandTimeout: AUTH_DENYLIST_COMMAND_TIMEOUT_MS },
)

// Namespaced because cluster mode ignores logical DB indexes (see
// createRedisClient's TODO) and always uses DB 0, so a bare hash would sit
// unscoped alongside other runtime data there.
const AUTH_DENYLIST_KEY_PREFIX = 'auth-deny:'

function denylistKey(token: string): string {
  return (
    AUTH_DENYLIST_KEY_PREFIX + createHash('sha256').update(token).digest('hex')
  )
}

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
    if (await isAuthCookieRevoked(token)) {
      return null
    }
    return User.query().findById(userId)
  } catch {
    return null
  }
}

async function isAuthCookieRevoked(token: string): Promise<boolean> {
  try {
    const denylisted = await authTokenDenylistClient.exists(denylistKey(token))
    return denylisted === 1
  } catch (error) {
    // ACCEPTED RISK: fails open. During a Redis outage, a token denylisted by
    // an earlier logout is treated as "not revoked" until Redis recovers, so
    // a captured pre-logout token could keep authenticating for that window.
    // This matches the rate limiter's posture (Redis is already load-bearing
    // for queues, so an outage already degrades the app broadly) and
    // prioritises not locking every user out over closing that window.
    logger.error('Failed to check auth token denylist', {
      event: 'auth-token-denylist-check-error',
      error: error.message,
    })
    return false
  }
}

export function deleteAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME)
}

/**
 * Revokes the current request's auth token server-side, on top of clearing
 * the cookie client-side, so a captured pre-logout token stops working
 * immediately instead of staying valid until it naturally expires.
 *
 * Only denylists the token presented at logout: it revokes this session, not
 * every session for the user (a later login mints an unrelated token that
 * this doesn't touch).
 *
 * Propagates a denylist-write failure instead of swallowing it, so the
 * caller (the `logout` mutation) doesn't clear the cookie / report success
 * when server-side revocation didn't actually happen.
 */
export async function invalidateAuthCookie(req: Request): Promise<void> {
  const token = getAuthCookie(req)
  if (!token) {
    return
  }

  let decoded: { exp?: number }
  try {
    // Verify (not just decode) so an expired or tampered token can't be used
    // to compute a bogus TTL; jwt.verify throws for both.
    decoded = jwt.verify(token, appConfig.sessionSecretKey) as { exp?: number }
  } catch {
    return
  }

  // Clamp so neither an unexpected `exp` nor clock skew between this host and
  // whichever host minted the token can produce a TTL outside the token's own
  // possible lifetime.
  const remainingTtlSec = decoded.exp
    ? Math.min(
        Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0),
        TOKEN_EXPIRES_IN_SEC,
      )
    : 0
  if (remainingTtlSec <= 0) {
    return
  }

  try {
    await authTokenDenylistClient.set(
      denylistKey(token),
      '1',
      'EX',
      remainingTtlSec,
    )
  } catch (error) {
    logger.error('Failed to revoke auth token on logout', {
      event: 'auth-token-revoke-error',
      error: error.message,
    })
    throw error
  }
}

/**
 * Rejects a first-time login when LD targets the email's domain.
 *
 * The flag serves the user-facing message itself, so an empty value means the
 * domain is not blocked. That keeps an LD outage from locking new users out.
 */
async function assertLoginNotBlocked(email: string): Promise<void> {
  const blockedMessage = await getLdFlagValue(BLOCK_NEW_LOGINS_FLAG, email, '')

  if (!blockedMessage) {
    return
  }

  logger.info({
    event: 'block-new-logins-rejected',
    email,
  })
  throw new BaseError(blockedMessage)
}

export async function getOrCreateUser(email: string): Promise<User> {
  email = email.trim().toLowerCase()

  let user = await User.query().findOne({ email })
  if (!user) {
    await assertLoginNotBlocked(email)
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
