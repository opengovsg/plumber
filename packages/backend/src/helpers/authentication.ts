import { Request, Response } from 'express'
import { createRateLimitRule, RedisStore } from 'graphql-rate-limit'
import { allow, and, not, or, rule, shield } from 'graphql-shield'

import { createRedisClient, REDIS_DB_INDEX } from '@/config/redis'
import { UnauthorisedError } from '@/errors/graphql-errors'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import {
  getAdminTokenUser,
  getLoggedInUser,
  parseAdminToken,
} from '@/helpers/auth'
import { getClientIp } from '@/helpers/get-client-ip'
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

  // Get tiles view key and token from headers
  context.tilesViewKey = req.headers['x-tiles-view-key'] as string | undefined
  context.tilesViewToken = req.headers['x-tiles-view-token'] as
    | string
    | undefined

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
    if (ctx.currentUser == null) {
      throw new UnauthorisedError()
    }
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
    return getClientIp(ctx.req)
  },
  // recommended flag: https://github.com/teamplanes/graphql-rate-limit#enablebatchrequestcache
  enableBatchRequestCache: true,
  store: new RedisStore(createRedisClient(REDIS_DB_INDEX.RATE_LIMIT)),
  createError: (message) => {
    return new RateLimitedError(message)
  },
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
    AdminQuery: isAdminOperation,
    Mutation: {
      '*': and(
        isAuthenticated,
        not(isAdminOperation), // Limiting admins to read-only for now.
      ),
      /**
       * Allow admins to retry steps and publish/unpublish pipes
       */
      retryPartialStep: or(isAuthenticated, isAdminOperation),
      retryExecutionStep: or(isAuthenticated, isAdminOperation),
      bulkRetryExecutions: or(isAuthenticated, isAdminOperation),
      updateFlowStatus: or(isAuthenticated, isAdminOperation),
      createFlowTransfer: or(isAuthenticated, isAdminOperation),
      requestOtp: rateLimitRule({ window: '1s', max: 5 }),
      verifyOtp: rateLimitRule({ window: '1s', max: 5 }),
      // Not OTP, but no real reason to be looser than OTP.
      loginWithSgid: rateLimitRule({ window: '1s', max: 5 }),
      loginWithSelectedSgid: rateLimitRule({ window: '1s', max: 5 }),
      loginWithSso: rateLimitRule({ window: '1s', max: 5 }),
      verifyTableViewPassword: and(
        isViewKey,
        rateLimitRule({ window: '1s', max: 5 }),
      ),
      admin: isAdminOperation,
    },
    AdminMutation: isAdminOperation,
  },
  {
    allowExternalErrors: true,
    // only affects shield authorisation failures
    fallbackError: new UnauthorisedError(),
  },
)

export default authentication
