import { Request, Response } from 'express'
import morgan from 'morgan'

import { readGraphqlRootFields } from '@/helpers/redaction/graphql-root-fields'
import { redactGraphqlVariables } from '@/helpers/redaction/redact-graphql-variables'
import { REDACTED } from '@/helpers/redaction/sensitive-keys'

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

/** Exported so a test can assert the exact string that reaches the log. */
export function getGraphqlVariables(req: Request): string | undefined {
  if (!req.body.variables) {
    return undefined
  }

  const variables = redactGraphqlVariables(
    readGraphqlRootFields(req),
    req.body.variables,
  )

  // Written bare, matching what the old SENSITIVE_MUTATIONS list logged.
  if (variables === REDACTED) {
    return REDACTED
  }

  return JSON.stringify(variables).replace(/"/g, "'")
}

morgan.token('graphql-variables', getGraphqlVariables)

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
