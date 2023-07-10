import { Request, Response } from 'express'
import { createRateLimitRule, RedisStore } from 'graphql-rate-limit'
import { allow, rule, shield } from 'graphql-shield'
import jwt from 'jsonwebtoken'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { getAuthCookie } from '@/helpers/cookie'
import User from '@/models/user'
import { UnauthenticatedContext } from '@/types/express/context'

export const setCurrentUserContext = async ({
  req,
  res,
}: {
  req: Request
  res: Response
}) => {
  const context: UnauthenticatedContext = { req, res, currentUser: null }
  const token = getAuthCookie(req)
  if (token == null) {
    return context
  }
  try {
    const { userId } = jwt.verify(token, appConfig.sessionSecretKey) as {
      userId: string
    }
    context.currentUser = await User.query().findById(userId)
  } catch (_) {
    context.currentUser = null
  }
  return context
}

const isAuthenticated = rule()(
  async (_parent, _args, ctx: UnauthenticatedContext) => {
    return ctx.currentUser != null
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
      healthcheck: allow,
      getCurrentUser: allow,
    },
    Mutation: {
      '*': isAuthenticated,
      requestOtp: rateLimitRule({ window: '1s', max: 5 }),
      verifyOtp: rateLimitRule({ window: '1s', max: 5 }),
    },
  },
  {
    allowExternalErrors: true,
  },
)

export default authentication
