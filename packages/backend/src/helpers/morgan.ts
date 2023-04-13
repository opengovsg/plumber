import { Request } from 'express'
import morgan, { StreamOptions } from 'morgan'

import logger from './logger'

const stream: StreamOptions = {
  write: (message) =>
    logger.http(message.substring(0, message.lastIndexOf('\n'))),
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
    }
  })
  morgan.token('graphql-variables', (req: Request) => {
    if (req.body.variables) {
      return JSON.stringify(req.body.variables)
    }
  })
}

registerGraphQLToken()

const morganJsonFormat = JSON.stringify(
  {
    method: ':method',
    url: ':url',
    status: ':status',
    'content-length': ':res[content-length]',
    'response-time': ':response-time',
    'ip-address': ':remote-addr',
    'cf-connecting-ip': ':cf-connecting-ip',
    'graphql-query': ':graphql-query',
    'graphql-variables': ':graphql-variables',
  },
  null,
  2,
)

const morganMiddleware = morgan(morganJsonFormat, { stream })

export default morganMiddleware
