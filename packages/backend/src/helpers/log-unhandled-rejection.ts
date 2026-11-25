import logger from './logger'

/**
 * IMPORTANT: Registering this as the `unhandledRejection` listener stops Node
 * from exiting, so one failed request cannot take down the whole server.
 */
export function logUnhandledRejection(reason: unknown): void {
  logger.error('Server unhandled rejection', {
    event: 'server-unhandled-rejection',
    errorName: reason instanceof Error ? reason.name : undefined,
    errorMessage: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
}
