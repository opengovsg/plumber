import logger from '@/helpers/logger'
import { shutdownTelemetry } from '@/instrumentation'

type Drain = () => Promise<unknown>

/**
 * Flushes telemetry after every drain settles on the first shutdown signal.
 *
 * IMPORTANT: Flushing earlier drops spans from work that is still finishing.
 */
export function registerGracefulShutdown(
  signals: NodeJS.Signals[],
  drains: Drain[],
): void {
  let isShuttingDown = false

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true
    logger.info(`${signal}: draining before shutdown`)

    const results = await Promise.allSettled(drains.map((drain) => drain()))
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error('Failed to drain during shutdown', {
          error: errorMessage(result.reason),
        })
      }
    }

    try {
      await shutdownTelemetry()
    } catch (error) {
      logger.warn('Failed to flush AI telemetry during shutdown', {
        error: errorMessage(error),
      })
    }
    logger.info(`${signal}: shutdown complete`)
  }

  for (const signal of signals) {
    process.once(signal, (received) => void shutdown(received))
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
