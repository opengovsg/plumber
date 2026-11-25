import {
  createLogsClient,
  EXECUTION_HISTORY_BUDGET_MS,
  exportMutationLog,
  exportSilverTables,
  loadExecutionArchivalFloor,
  previousSgtDay,
} from 'backend-analytics'

import { archivalConfig } from '@/helpers/archival/config'
import { archivalDb, archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { runArchivalLoop } from '@/helpers/archival/run-archival-loop'
import { runMutationLogExport } from '@/helpers/archival/run-mutation-log-export'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const controller = new AbortController()
// Archival waits for this export, so a stalled Logs Insights query must not hold it up past this.
const MUTATION_LOG_DEADLINE_MS = 30 * 60 * 1_000

process.on('SIGTERM', () => {
  logger.info({ event: 'archival.run.sigterm' })
  controller.abort()
})

// A failed export does not block archival. Archival keeps each run until its execution days are final instead.
async function runAnalyticsExport(): Promise<boolean> {
  const startedAt = Date.now()
  try {
    await exportSilverTables({
      db: archivalDbReader,
      s3Client: archiveS3Client,
      appEnv: archivalConfig.appEnv,
      bucket: archivalConfig.analyticsBucket,
      historyBudgetMs: EXECUTION_HISTORY_BUDGET_MS,
      signal: controller.signal,
    })
    // No deadline yet. Alert on durationMs if exports grow slow enough to delay archival.
    logger.info({
      event: 'analytics.export.complete',
      durationMs: Date.now() - startedAt,
    })
    return true
  } catch (err) {
    logger.error({
      event: 'analytics.export.error',
      durationMs: Date.now() - startedAt,
      err,
    })
    return false
  }
}

async function main(): Promise<void> {
  const analyticsExported = await runAnalyticsExport()
  const mutationLogExported = await runMutationLogExport({
    run: (signal) =>
      exportMutationLog({
        db: archivalDbReader,
        logsClient: createLogsClient('ap-southeast-1'),
        s3Client: archiveS3Client,
        appEnv: archivalConfig.appEnv,
        bucket: archivalConfig.analyticsBucket,
        logGroup: archivalConfig.analyticsRequestLogGroup,
        days: { through: previousSgtDay(new Date()) },
        signal,
      }),
    deadlineMs: MUTATION_LOG_DEADLINE_MS,
    stop: controller.signal,
  })
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
    const keepFrom = await loadExecutionArchivalFloor({
      s3Client: archiveS3Client,
      appEnv: archivalConfig.appEnv,
      bucket: archivalConfig.analyticsBucket,
    })
    logger.info({
      event: 'archival.analytics_floor',
      keepFrom: keepFrom?.toISOString() ?? null,
    })
    await runArchivalLoop(controller.signal, { keepFrom })
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
