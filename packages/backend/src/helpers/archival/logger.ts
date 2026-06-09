import winston from 'winston'

import { archivalConfig } from './config'

const archivalLogger = winston.createLogger({
  level: archivalConfig.isDev ? 'debug' : 'info',
  format: archivalConfig.isDev
    ? winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.simple(),
      )
    : winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.json(),
      ),
  transports: [new winston.transports.Console()],
})

export default archivalLogger
