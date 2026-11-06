import { exportSilverTables } from '@/helpers/analytics/export-silver-tables'
import {
  exportMutationLog,
  previousSgtDay,
} from '@/helpers/analytics/mutation-log/export-mutation-log'
import { logsClient } from '@/helpers/analytics/mutation-log/logs-client'
import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb, archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { runArchivalLoop } from '@/helpers/archival/run-archival-loop'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const controller = new AbortController()

process.on('SIGTERM', () => {
  logger.info({ event: 'archival.run.sigterm' })
  controller.abort()
})

// A failed export does not block archival yet. No exported table reads executions.
async function runAnalyticsExport(): Promise<boolean> {
  try {
    await exportSilverTables({
      db: archivalDbReader,
      s3Client: archiveS3Client,
      appEnv: archivalConfig.appEnv,
      bucket: archivalConfig.analyticsBucket,
    })
    return true
  } catch (err) {
    logger.error({ event: 'analytics.export.error', err })
    return false
  }
}

async function runMutationLogExport(): Promise<boolean> {
  try {
    await exportMutationLog({
      logsClient,
      s3Client: archiveS3Client,
      appEnv: archivalConfig.appEnv,
      bucket: archivalConfig.analyticsBucket,
      logGroup: archivalConfig.analyticsRequestLogGroup,
      days: [previousSgtDay(new Date())],
    })
    return true
  } catch (err) {
    logger.error({ event: 'analytics.mutation_log.error', err })
    return false
  }
}

async function main(): Promise<void> {
  const analyticsExported = await runAnalyticsExport()
  const mutationLogExported = await runMutationLogExport()
  const exitCode = analyticsExported && mutationLogExported ? 0 : 1

  if (!archivalConfig.archiveEnabled) {
    logger.info({ event: 'archival.run.disabled' })
    process.exit(exitCode)
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
    process.exit(1)
  }

  await archivalDb.destroy()
  process.exit(exitCode)
}

main().catch((err) => {
  logger.error({ event: 'archival.run.error', err })
  process.exit(1)
})
