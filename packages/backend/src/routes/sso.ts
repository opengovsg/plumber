import type { CookieOptions, Request, Response } from 'express'
import { Router } from 'express'
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { z } from 'zod'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import {
  getOrCreateUser,
  sendOnboardingEmail,
  setAuthCookie,
  updateLastLogin,
} from '@/helpers/auth'
import { getClientIp } from '@/helpers/get-client-ip'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { isAllowedSsoEmail } from '@/helpers/sso-access'
import {
  decideSsoCallback,
  ssoCallbackQuerySchema,
} from '@/helpers/sso-callback'
import { ssoClient, ssoIssuer } from '@/helpers/sso-client'
import {
  consumeSsoLoginTransaction,
  createSsoTransactionId,
  SSO_TRANSACTION_COOKIE_NAME,
  SSO_TRANSACTION_TTL_SECONDS,
  storeSsoLoginTransaction,
} from '@/helpers/sso-login-transaction'

const loginStartRateLimiter = new RateLimiterRedis({
  points: 20,
  duration: 60,
  keyPrefix: 'sso-login-start',
  storeClient: createRedisClient(REDIS_DB_INDEX.RATE_LIMIT),
})

const transactionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: !appConfig.isDev,
  maxAge: SSO_TRANSACTION_TTL_SECONDS * 1000,
  path: '/api/login/sso',
}

function webAppPath(path: string): string {
  return `${appConfig.webAppUrl}${path}`
}

function clearTransactionCookie(res: Response): void {
  res.clearCookie(SSO_TRANSACTION_COOKIE_NAME, {
    path: transactionCookieOptions.path,
  })
}

export async function startSsoLogin(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    await loginStartRateLimiter.consume(getClientIp(req))
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      res.status(429).send('Too many login attempts. Please try again later.')
      return
    }
    logger.error('SSO login rate limiter error', {
      event: 'sso-login-rate-limit-error',
    })
  }

  const ssoEnabled = await getLdFlagValue<boolean>(
    'ogp-sso-enabled',
    null,
    false,
  )
  if (!ssoEnabled) {
    res.status(404).send('Not found')
    return
  }

  const issResult = z.string().optional().safeParse(req.query.iss)
  if (!issResult.success) {
    res.status(400).send('Invalid login request')
    return
  }
  if (issResult.data !== undefined && issResult.data !== ssoIssuer) {
    res.status(400).send('Invalid issuer')
    return
  }

  try {
    const authorization = await ssoClient.authorizationUrl()
    const transactionId = createSsoTransactionId()
    await storeSsoLoginTransaction(transactionId, {
      state: authorization.state,
      nonce: authorization.nonce,
      codeVerifier: authorization.codeVerifier,
    })
    res.cookie(
      SSO_TRANSACTION_COOKIE_NAME,
      transactionId,
      transactionCookieOptions,
    )
    res.redirect(303, authorization.authorizationUrl)
  } catch (error) {
    logger.error('SSO login start failed', {
      event: 'sso-login-start-failed',
    })
    res.redirect(303, webAppPath('/login?sso_error=1'))
  }
}

export async function handleSsoCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    await handleSsoCallbackUnsafe(req, res)
  } catch (error) {
    logger.error('SSO callback failed', {
      event: 'sso-login-callback-failed',
    })
    if (!res.headersSent) {
      res.redirect(303, webAppPath('/login?sso_error=1'))
    }
  }
}

async function handleSsoCallbackUnsafe(
  req: Request,
  res: Response,
): Promise<void> {
  const transactionId = req.cookies?.[SSO_TRANSACTION_COOKIE_NAME]
  if (typeof transactionId !== 'string' || transactionId.length === 0) {
    res.status(400).send('Invalid login request')
    return
  }

  const transaction = await consumeSsoLoginTransaction(transactionId)
  if (!transaction) {
    res.status(400).send('Invalid login request')
    return
  }
  clearTransactionCookie(res)

  const parsedQuery = ssoCallbackQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) {
    res.status(400).send('Invalid login request')
    return
  }

  const decision = decideSsoCallback({
    query: parsedQuery.data,
    storedState: transaction.state,
    issuer: ssoIssuer,
  })

  if (decision.type === 'idp-error') {
    logger.info('SSO authorization returned an error', {
      event: 'sso-login-idp-error',
    })
    res.redirect(303, webAppPath('/login?sso_error=1'))
    return
  }

  if (decision.type === 'invalid') {
    res.status(400).send('Invalid login request')
    return
  }

  try {
    const claims = await ssoClient.exchangeAuthorizationCode({
      code: decision.code,
      state: transaction.state,
      iss: parsedQuery.data.iss as string,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    })

    const email = (claims.email ?? claims.sub).toLowerCase().trim()
    if (!isAllowedSsoEmail(email)) {
      logger.info('SSO login denied by access policy', {
        event: 'sso-login-denied',
      })
      res.redirect(303, webAppPath('/login/sso/unauthorized'))
      return
    }

    const user = await getOrCreateUser(email)
    await sendOnboardingEmail(user)
    await updateLastLogin(user.id)
    setAuthCookie(res, {
      userId: user.id,
      isSso: true,
      ssoSid: claims.sid,
    })
    res.redirect(303, webAppPath('/flows'))
  } catch (error) {
    logger.error('SSO callback failed', {
      event: 'sso-login-callback-failed',
    })
    res.redirect(303, webAppPath('/login?sso_error=1'))
  }
}

const ssoRouter = Router()
ssoRouter.get('/', (req, res) => {
  void startSsoLogin(req, res)
})
ssoRouter.get('/callback', (req, res) => {
  void handleSsoCallback(req, res)
})

export default ssoRouter
