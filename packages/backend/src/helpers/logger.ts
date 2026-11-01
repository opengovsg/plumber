import * as winston from 'winston'

import appEnvConfig from '@/config/app/load-app-env'
import { redactSecrets } from '@/helpers/redaction/redact-log-secrets'

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const level = () => {
  return appEnvConfig.isDev ? 'debug' : 'http'
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactSecrets(),
  appEnvConfig.isDev
    ? winston.format.prettyPrint({ colorize: true })
    : winston.format.json(),
)

const transports = [new winston.transports.Console()]

export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
})

export default logger
