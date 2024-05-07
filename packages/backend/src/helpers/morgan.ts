import { Request, Response } from 'express'
import morgan from 'morgan'

import logger from './logger'

const morganOptions: morgan.Options<Request, Response> = {
  skip: (req, _res) => {
    return [/^\/$/, /^\/apps\/.+\/assets\/favicon\.svg$/].some((regex) =>
      regex.test(req.originalUrl),
    )
  },
  stream: {
    write: (message) => {
      try {
        logger.http(JSON.parse(message))
      } catch {
        logger.http(message)
      }
    },
  },
}

morgan.token('cf-connecting-ip', (req: Request) => {
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'] as string
  }
})
morgan.token('graphql-query', (req: Request) => {
  if (typeof req.body.query === 'string') {
    return req.body.query
      .replace(/\s+/g, ' ')
      .replace(/\n/g, '')
      .replace(/"/g, "'")
  }
})

const SENSITIVE_MUTATIONS = [
  'createConnection',
  'updateConnection',
  'createRows',
  'deleteRows',
]

morgan.token('graphql-variables', (req: Request) => {
  if (req.body.variables) {
    // redact sensitive graphql variables related to connections
    if (typeof req.body.query === 'string') {
      if (
        SENSITIVE_MUTATIONS.some((mutation) =>
          req.body.query.includes(mutation),
        )
      ) {
        return '[redacted]'
      }
    }
    return JSON.stringify(req.body.variables).replace(/"/g, "'")
  }
})

const morganJsonFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  'content-length': ':res[content-length]',
  'response-time': ':response-time',
  'ip-address': ':remote-addr',
  'cf-connecting-ip': ':cf-connecting-ip',
  'graphql-query': ':graphql-query',
  'graphql-variables': ':graphql-variables',
})

const morganMiddleware = morgan(morganJsonFormat, morganOptions)

export default morganMiddleware
