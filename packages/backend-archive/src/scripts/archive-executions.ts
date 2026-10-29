import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { runArchivalLoop } from '@/helpers/archival/run-archival-loop'

const controller = new AbortController()

// process.exit drops stdout writes still queued for the pipe, which lost the final logs of
// a prod run. The empty write's callback fires only once everything before it has flushed.
async function flushAndExit(code: number): Promise<never> {
  await new Promise<void>((resolve) =>
    process.stdout.write('', () => resolve()),
  )
  process.exit(code)
}

process.on('SIGTERM', () => {
  logger.info({ event: 'archival.run.sigterm' })
  controller.abort()
})

async function main(): Promise<void> {
  if (!archivalConfig.archiveEnabled) {
    logger.info({ event: 'archival.run.disabled' })
    await flushAndExit(0)
  }

  logger.info({
    event: 'archival.run.start',
    dryRun: archivalConfig.archiveDryRun,
    retentionDays: archivalConfig.archiveRetentionDays,
    batchSize: archivalConfig.archiveBatchSize,
    sleepMs: archivalConfig.archiveBatchSleepMs,
    testRuns: archivalConfig.archiveTestRuns,
    deletedFlowsOnly: archivalConfig.archiveDeletedFlowsOnly,
  })

  try {
    await runArchivalLoop(controller.signal)
  } catch (err) {
    logger.error({ event: 'archival.run.error', err })
    await archivalDb.destroy()
    await flushAndExit(1)
  }

  await archivalDb.destroy()
  await flushAndExit(0)
}

main().catch(async (err) => {
  logger.error({ event: 'archival.run.error', err })
  await flushAndExit(1)
})
