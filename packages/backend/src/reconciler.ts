// dd-trace must load before pg and ioredis to instrument them.
import '@/helpers/tracer'
import '@/config/orm'
import { client as knexClient } from '@/config/database'
import logger from '@/helpers/logger'
import { createReconcilerChecks } from '@/services/reconciler/checks'
import { createReconcilerRedisClient } from '@/services/reconciler/redis'
import { runReconcilerLoop } from '@/services/reconciler/run-loop'

const CHECK_TIMEOUT_SECONDS = 60
const SHUTDOWN_WAIT_SECONDS = 20

const jobsRedis = createReconcilerRedisClient()
const loop = runReconcilerLoop({
  checks: createReconcilerChecks({ jobsRedis }),
  checkTimeoutSeconds: CHECK_TIMEOUT_SECONDS,
})

logger.info('Reconciler started', { event: 'reconciler-started' })

let isShuttingDown = false

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true
  logger.info('Reconciler stopping', { event: 'reconciler-stopping' })

  let waitTimer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      loop.stop(),
      new Promise<void>((resolve) => {
        waitTimer = setTimeout(resolve, SHUTDOWN_WAIT_SECONDS * 1000)
      }),
    ])
    await knexClient.destroy()
    await jobsRedis.quit()
  } catch (error) {
    logger.error('Reconciler shutdown failed', {
      event: 'reconciler-shutdown-failed',
      error,
    })
  } finally {
    clearTimeout(waitTimer)
  }

  process.exit(0)
}

// A fresh process is safer than unknown state, and the ECS restart policy brings it back.
function exitOnFatalError(source: string) {
  return (error: unknown) => {
    logger.error(`Reconciler ${source}`, {
      event: 'reconciler-fatal-error',
      error,
    })
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('uncaughtException', exitOnFatalError('uncaught exception'))
process.on('unhandledRejection', exitOnFatalError('unhandled rejection'))
