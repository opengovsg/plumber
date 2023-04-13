import { Request } from 'express'
import morgan, { StreamOptions } from 'morgan'

import logger from './logger'

const stream: StreamOptions = {
  write: (message) => {
    try {
      logger.http(JSON.parse(message))
    } catch {
      logger.http(message)
    }
  },
}

const registerGraphQLToken = () => {
  morgan.token('cf-connecting-ip', (req: Request) => {
    if (req.headers['cf-connecting-ip']) {
      return req.headers['cf-connecting-ip'] as string
    }
  })

  morgan.token('graphql-query', (req: Request) => {
    if (req.body.query) {
      return req.body.query
        .replace(/\s+/g, ' ')
        .replace(/\n/g, '')
        .replace(/"/g, "'")
    }
  })
  morgan.token('graphql-variables', (req: Request) => {
    if (req.body.variables) {
      return JSON.stringify(req.body.variables).replace(/"/g, "'")
    }
  })
}

registerGraphQLToken()

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

const morganMiddleware = morgan(morganJsonFormat, { stream })

export default morganMiddleware
