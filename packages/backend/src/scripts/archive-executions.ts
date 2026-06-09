import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { runArchivalLoop } from '@/helpers/archival/run-archival-loop'

const controller = new AbortController()

process.on('SIGTERM', () => {
  logger.info({ event: 'archival.run.sigterm' })
  controller.abort()
})

async function main(): Promise<void> {
  if (!archivalConfig.archiveEnabled) {
    logger.info({ event: 'archival.run.disabled' })
    process.exit(0)
  }

  if (!archivalConfig.archiveExecutionsBucket || !archivalConfig.archiveTestExecutionsBucket) {
    logger.error(
      {
        archiveExecutionsBucket: archivalConfig.archiveExecutionsBucket,
        archiveTestExecutionsBucket: archivalConfig.archiveTestExecutionsBucket,
      },
      'archival: ARCHIVE_EXECUTIONS_BUCKET and ARCHIVE_TEST_EXECUTIONS_BUCKET must be set',
    )
    process.exit(1)
  }

  logger.info({
    event: 'archival.run.start',
    dryRun: archivalConfig.archiveDryRun,
    retentionDays: archivalConfig.archiveRetentionDays,
    batchSize: archivalConfig.archiveBatchSize,
    sleepMs: archivalConfig.archiveBatchSleepMs,
  })

  try {
    await runArchivalLoop(controller.signal)
  } catch (err) {
    logger.error({ event: 'archival.run.error', err })
    await archivalDb.destroy()
    process.exit(1)
  }

  await archivalDb.destroy()
  process.exit(0)
}

main().catch((err) => {
  logger.error({ event: 'archival.run.error', err })
  process.exit(1)
})
