import type { NextFunction, Request, Response } from 'express'

import { setCurrentUserContext as setGraphQLContext } from '@/helpers/authentication'
import type Context from '@/types/express/context'

/**
 * Middleware to set the current user context on the request object.
 * This reuses the same authentication logic as GraphQL mutations.
 */
export async function setCurrentUserContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Reuse the GraphQL context creation logic
  const context = await setGraphQLContext({ req, res })

  // Attach context to the request object
  req.context = context

  next()
}

/**
 * Middleware to ensure the user is authenticated before allowing the request to proceed.
 * Returns 401 if the user is not authenticated.
 */
export function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.context?.currentUser) {
    res.status(401).json({ error: 'Not Authorised!' })
    return
  }

  next()
}

/**
 * Type guard to ensure the request has an authenticated context.
 * Use this in route handlers to get type-safe access to currentUser.
 */
export function getAuthenticatedContext(req: Request): Context {
  if (!req.context?.currentUser) {
    throw new Error('User must be authenticated')
  }

  return req.context
}

/**
 * Middleware to block admin operations from making mutations.
 * Admins are limited to read-only operations by default.
 * Returns 403 if the request is an admin operation.
 */
export function blockAdminOperations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.context?.isAdminOperation) {
    res.status(403).json({ error: 'Admin operations are read-only' })
    return
  }

  next()
}

/**
 * Middleware to allow admin operations (bypass the admin mutation block).
 * Use this for specific endpoints where admins should have write access.
 */
export function allowAdminOperations(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  // This middleware does nothing but can be used to explicitly allow admin operations
  // by placing it before blockAdminMutations in the middleware chain
  next()
}
