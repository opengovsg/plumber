// dd-trace must load before pg and ioredis to instrument them.
import '@/helpers/tracer'
import '@/config/orm'
import { client as knexClient } from '@/config/database'
import logger from '@/helpers/logger'
import { redisAppDataClient } from '@/helpers/redis-app-data'
import { createReconcilerChecks } from '@/services/reconciler/checks'
import {
  createReconcilerRedisClient,
  logReconcilerRedisErrors,
} from '@/services/reconciler/redis'
import { runChecksOnce } from '@/services/reconciler/run-checks'

// A normal run takes seconds, so this ends a hung run long before the next scheduled start.
const RUN_DEADLINE_SECONDS = 300
// Below the container's 30 s stopTimeout, so ECS never kills it mid-cleanup.
const SHUTDOWN_WAIT_SECONDS = 20

const jobsRedis = createReconcilerRedisClient()
logReconcilerRedisErrors(redisAppDataClient)

let exitCode = 0
let isExiting = false
let isLoggerEnded = false

async function closeConnections(): Promise<void> {
  await knexClient.destroy()
  await jobsRedis.quit()
  await redisAppDataClient.quit()
}

async function closeConnectionsWithinWait(): Promise<void> {
  let waitTimer: NodeJS.Timeout | undefined
  try {
    // A hung Redis command can block quit() forever.
    await Promise.race([
      closeConnections(),
      new Promise<void>((resolve) => {
        waitTimer = setTimeout(resolve, SHUTDOWN_WAIT_SECONDS * 1000)
      }),
    ])
  } catch (error) {
    exitCode = 1
    logger.error('Reconciler failed to close connections', {
      event: 'reconciler-close-failed',
      error,
    })
  } finally {
    clearTimeout(waitTimer)
  }
}

// A missed-run line lost at exit loses its count for good.
function flushLogger(): Promise<void> {
  isLoggerEnded = true
  return new Promise((resolve) => {
    logger.once('finish', () => resolve())
    logger.end()
  })
}

async function exitAfterCleanup(): Promise<void> {
  if (isExiting) {
    return
  }
  isExiting = true
  await closeConnectionsWithinWait()
  await flushLogger()
  process.exit(exitCode)
}

function failRun(message: string, meta: Record<string, unknown>): void {
  exitCode = 1
  // The ended logger rejects new lines, and a hung flush must not hold the exit.
  if (isLoggerEnded) {
    process.exit(1)
    return
  }
  logger.error(message, meta)
  void exitAfterCleanup()
}

async function run(): Promise<void> {
  logger.info('Reconciler started', { event: 'reconciler-started' })
  const allSucceeded = await runChecksOnce({
    checks: createReconcilerChecks({
      jobsRedis,
      markerRedis: redisAppDataClient,
    }),
  })
  if (!allSucceeded) {
    exitCode = 1
  }
  await exitAfterCleanup()
}

function exitOnFatalError(source: string) {
  return (error: unknown) =>
    failRun(`Reconciler ${source}`, {
      event: 'reconciler-fatal-error',
      error,
    })
}

process.on('uncaughtException', exitOnFatalError('uncaught exception'))
process.on('unhandledRejection', exitOnFatalError('unhandled rejection'))
// The run did not finish its checks, e.g. a human stopped the task.
process.on('SIGTERM', () =>
  failRun('Reconciler stopped before finishing', {
    event: 'reconciler-stopped',
  }),
)

// IMPORTANT: never unref this timer. It must end a run that waits on I/O forever.
setTimeout(
  () =>
    failRun('Reconciler run passed its deadline', {
      event: 'reconciler-run-deadline',
      deadlineSeconds: RUN_DEADLINE_SECONDS,
    }),
  RUN_DEADLINE_SECONDS * 1000,
)

run().catch(exitOnFatalError('run error'))
