import type { NextFunction, Request, Response } from 'express'

import { AI_CHAT_TOO_LONG_MESSAGE } from './ai/get-ai-chat-error-message'
import logger from './logger'

// The shape http-errors and body-parser give the errors they create.
type HttpError = Error & {
  status?: number
  statusCode?: number
  type?: string
  length?: number
  limit?: number
}

// IMPORTANT: Express only treats a handler with 4 parameters as an error handler.
const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err.type === 'entity.too.large') {
    logger.warn('Request body too large', {
      path: req.path,
      length: err.length,
      limit: err.limit,
    })
    // The AI Builder resends its whole chat history, so this is how a long chat fails.
    res.status(413).json({
      error: req.path.startsWith('/api/chat')
        ? AI_CHAT_TOO_LONG_MESSAGE
        : 'Request body too large',
    })
    return
  }

  const status = err.status ?? err.statusCode ?? 500
  if (status >= 400 && status < 500) {
    res.status(status).end()
    return
  }

  logger.error(err.message, { path: req.path })
  res.status(500).end()
}

export default errorHandler
