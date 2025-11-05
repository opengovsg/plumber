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
  req.context = context as Context

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

  return req.context as Context
}
