import { Request, Response } from 'express'
import { createRateLimitRule, RedisStore } from 'graphql-rate-limit'
import { allow, rule, shield } from 'graphql-shield'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { getLoggedInUser } from '@/helpers/auth'
import { UnauthenticatedContext } from '@/types/express/context'

export const setCurrentUserContext = async ({
  req,
  res,
}: {
  req: Request
  res: Response
}): Promise<UnauthenticatedContext> => {
  const context: UnauthenticatedContext = { req, res, currentUser: null }

  // Get tiles view key from headers
  context.tilesViewKey = req.headers['x-tiles-view-key'] as string | undefined

  context.currentUser = await getLoggedInUser(req)
  return context
}

const isAuthenticated = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.currentUser != null
  },
)

const isAuthenticatedOrViewKey = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.currentUser != null || ctx.tilesViewKey != null
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
      '*': isAuthenticated,
      getTable: isAuthenticatedOrViewKey,
      getAllRows: isAuthenticatedOrViewKey,
      healthcheck: allow,
      getCurrentUser: allow,
      getPlumberStats: allow,
    },
    Mutation: {
      '*': isAuthenticated,
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
