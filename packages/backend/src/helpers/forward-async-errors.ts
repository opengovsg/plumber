import type { NextFunction, Request, Response } from 'express'

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>

/**
 * Passes a rejected async handler's error to `next`.
 *
 * IMPORTANT: Express 4 ignores the returned promise, so an unforwarded
 * rejection becomes a process-level unhandled rejection.
 */
export function forwardAsyncErrors(
  handler: AsyncRequestHandler,
): AsyncRequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (err) {
      next(err)
    }
  }
}
