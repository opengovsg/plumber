import winston from 'winston'

const isDev = (process.env.APP_ENV ?? 'development') === 'development'

// Matches the archival logger's JSON shape, so Datadog parses both the same way.
const analyticsLogger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
})

export default analyticsLogger
