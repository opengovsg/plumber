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

  if (
    !archivalConfig.archiveExecutionsBucket ||
    !archivalConfig.archiveTestExecutionsBucket
  ) {
    logger.error(
      'archival: ARCHIVE_EXECUTIONS_BUCKET and ARCHIVE_TEST_EXECUTIONS_BUCKET must be set',
      {
        archiveExecutionsBucket: archivalConfig.archiveExecutionsBucket,
        archiveTestExecutionsBucket: archivalConfig.archiveTestExecutionsBucket,
      },
    )
    process.exit(1)
  }

  logger.info('archival.run.start', {
    dryRun: archivalConfig.archiveDryRun,
    retentionDays: archivalConfig.archiveRetentionDays,
    batchSize: archivalConfig.archiveBatchSize,
    sleepMs: archivalConfig.archiveBatchSleepMs,
  })

  try {
    await runArchivalLoop(controller.signal)
  } catch (err) {
    logger.error('archival: fatal error', { event: 'archival.run.error', err })
    await archivalDb.destroy()
    process.exit(1)
  }

  await archivalDb.destroy()
  process.exit(0)
}

main()
