import { Request, Response } from 'express'
import { createRateLimitRule, RedisStore } from 'graphql-rate-limit'
import { allow, and, not, or, rule, shield } from 'graphql-shield'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import {
  getAdminTokenUser,
  getLoggedInUser,
  parseAdminToken,
} from '@/helpers/auth'
import { UnauthenticatedContext } from '@/types/express/context'

export const setCurrentUserContext = async ({
  req,
  res,
}: {
  req: Request
  res: Response
}): Promise<UnauthenticatedContext> => {
  const context: UnauthenticatedContext = {
    req,
    res,
    currentUser: null,
    isAdminOperation: false,
  }

  // Get tiles view key from headers
  context.tilesViewKey = req.headers['x-tiles-view-key'] as string | undefined

  if (typeof req.headers['x-plumber-admin-token'] === 'string') {
    const adminToken = parseAdminToken(req.headers['x-plumber-admin-token'])
    if (!adminToken) {
      // If admin token is specified but it's invalid, something's really wrong
      // so we abort immediately instead of falling back to getLoggedInUser.
      return context
    }

    context.currentUser = await getAdminTokenUser(adminToken)
    context.isAdminOperation = true
  } else {
    context.currentUser = await getLoggedInUser(req)
  }

  return context
}

const isAuthenticated = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.currentUser != null
  },
)

const isViewKey = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.tilesViewKey != null
  },
)

const isAdminOperation = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.isAdminOperation
  },
)

const rateLimitRule = createRateLimitRule({
  identifyContext: (ctx: UnauthenticatedContext) => {
    // get ip address of request in this order: cf-connecting-ip -> remoteAddress
    const userIp =
      (ctx.req.headers['cf-connecting-ip'] as string) ||
      ctx.req.socket.remoteAddress.split(',')[0].trim()
    return userIp
  },
  // recommended flag: https://github.com/teamplanes/graphql-rate-limit#enablebatchrequestcache
  enableBatchRequestCache: true,
  store: new RedisStore(createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)),
})

const authentication = shield(
  {
    Query: {
      '*': or(isAuthenticated, isAdminOperation),
      getTable: or(isAuthenticated, isAdminOperation, isViewKey),
      getAllRows: or(isAuthenticated, isAdminOperation, isViewKey),
      healthcheck: allow,
      getCurrentUser: allow,
      getPlumberStats: allow,
    },
    Mutation: {
      '*': and(
        isAuthenticated,
        not(isAdminOperation), // Limiting admins to read-only for now.
      ),
      requestOtp: rateLimitRule({ window: '1s', max: 5 }),
      verifyOtp: rateLimitRule({ window: '1s', max: 5 }),
      // Not OTP, but no real reason to be looser than OTP.
      loginWithSgid: rateLimitRule({ window: '1s', max: 5 }),
      loginWithSelectedSgid: rateLimitRule({ window: '1s', max: 5 }),
    },
  },
  {
    allowExternalErrors: true,
  },
)

export default authentication
