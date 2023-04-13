import * as winston from 'winston'

import appConfig from '../config/app'

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const level = () => {
  return appConfig.isDev ? 'debug' : 'http'
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
  appConfig.isDev
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
