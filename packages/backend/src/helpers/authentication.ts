import { createRateLimitRule, RedisStore } from 'graphql-rate-limit'
import { allow, rule, shield } from 'graphql-shield'
import jwt from 'jsonwebtoken'

import appConfig from '@/config/app'
import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import User from '@/models/user'
import Context from '@/types/express/context'

const isAuthenticated = rule()(async (_parent, _args, req) => {
  const token = req.headers['authorization']

  if (token == null) {
    return false
  }

  try {
    const { userId } = jwt.verify(token, appConfig.sessionSecretKey) as {
      userId: string
    }
    req.currentUser = await User.query().findById(userId).throwIfNotFound()

    return true
  } catch (error) {
    return false
  }
})

const rateLimitRule = createRateLimitRule({
  identifyContext: (ctx: Context) => {
    // get ip address of request in this order: cf-connecting-ip -> remoteAddress
    const userIp =
      (ctx.headers['cf-connecting-ip'] as string) ||
      ctx.socket.remoteAddress.split(',')[0].trim()
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
