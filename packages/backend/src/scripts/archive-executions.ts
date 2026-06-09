import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { runArchivalLoop } from '@/helpers/archival/run-archival-loop'

const controller = new AbortController()

process.on('SIGTERM', () => {
  logger.info('archival: SIGTERM received, stopping after current batch')
  controller.abort()
})

async function main(): Promise<void> {
  if (!archivalConfig.archiveEnabled) {
    logger.info('archival: ARCHIVE_ENABLED is not true, exiting')
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
    logger.error({ event: 'archival.run.error', err }, 'archival: fatal error')
    await archivalDb.destroy()
    process.exit(1)
  }

  await archivalDb.destroy()
  process.exit(0)
}

main()
