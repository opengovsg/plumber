import winston from 'winston'

import { archivalConfig } from './config'

function safeStringify(obj: unknown): string {
  const seen = new WeakSet()
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

const archivalLogger = winston.createLogger({
  level: archivalConfig.isDev ? 'debug' : 'info',
  format: archivalConfig.isDev
    ? winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, ...meta }) => {
          if (typeof message === 'object') {
            return `${level}: ${safeStringify({ ...meta, ...message })}`
          }
          const metaStr = Object.keys(meta).length
            ? ` ${safeStringify(meta)}`
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
