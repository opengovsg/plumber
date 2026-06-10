import winston from 'winston'

import { archivalConfig } from './config'

const archivalLogger = winston.createLogger({
  level: archivalConfig.isDev ? 'debug' : 'info',
  format: archivalConfig.isDev
    ? winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, ...meta }) => {
          if (typeof message === 'object') {
            return `${level}: ${JSON.stringify({ ...meta, ...message })}`
          }
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : ''
          return `${level}: ${message}${metaStr}`
        }),
      )
    : winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.json(),
      ),
  transports: [new winston.transports.Console()],
})

export default archivalLogger
