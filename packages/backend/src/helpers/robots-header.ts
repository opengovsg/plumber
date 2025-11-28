import { NextFunction, Request, Response } from 'express'

const robotsHeaderMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Add X-Robots-Tag header for all /tiles/* routes
  if (req.path.startsWith('/tiles/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  }
  next()
}

export default robotsHeaderMiddleware
