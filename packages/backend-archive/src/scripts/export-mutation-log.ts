import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  claimLocalExportDir,
  createLogsClient,
  dbFlowIdResolver,
  exportMutationLog,
  exportMutationLogToDir,
  logsInsightsFetcher,
  previousSgtDay,
  sgtDaysBetween,
} from 'backend-analytics'

import { archivalConfig } from '@/helpers/archival/config'
import { archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { checkMutationLogBackfill } from '@/helpers/archival/mutation-log-backfill'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const USAGE = `Usage: analytics:mutation-log --from YYYY-MM-DD [--to YYYY-MM-DD] [--log-group <name>] (--out <dir> | --s3)
  --from       First Singapore day to extract.
  --to         Last Singapore day, inclusive. Default: --from.
  --log-group  Server log group, with --out only. Default: ANALYTICS_REQUEST_LOG_GROUP. Skips the database lookups, since the reader may be another environment.
  --out        Write the files under this local folder. Runs in any APP_ENV. Reads steps through the database reader.
  --s3         Write to ANALYTICS_BUCKET, exactly as the nightly job does. Prod and staging only. Finished days only.`

const logsClient = createLogsClient('ap-southeast-1')

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      'log-group': { type: 'string' },
      out: { type: 'string' },
      s3: { type: 'boolean', default: false },
    },
  })
  if (!values.from || Boolean(values.out) === values.s3) {
    throw new Error(USAGE)
  }

  const days = sgtDaysBetween(values.from, values.to ?? values.from)
  checkMutationLogBackfill({
    s3: values.s3,
    appEnv: archivalConfig.appEnv,
    logGroupOverride: values['log-group'],
    lastDay: days[days.length - 1],
    yesterday: previousSgtDay(new Date()),
  })
  const logGroup =
    values['log-group'] ?? archivalConfig.analyticsRequestLogGroup

  if (values.out) {
    if (!logGroup) {
      throw new Error(USAGE)
    }
    const dir = path.resolve(values.out)
    // An overridden log group may belong to another environment than the database reader, so its ids would not match.
    const lookUpIds = !values['log-group']
    if (!lookUpIds) {
      logger.warn({ event: 'analytics.mutation_log.local.lookups_skipped' })
    }
    await claimLocalExportDir(dir, {
      appEnv: archivalConfig.appEnv,
      host: archivalConfig.postgresReaderHost,
      database: archivalConfig.postgresDatabase,
      logGroup,
    })
    await exportMutationLogToDir({
      dir,
      fetchDayLines: logsInsightsFetcher(logsClient, logGroup),
      resolveFlowIds: lookUpIds
        ? dbFlowIdResolver(archivalDbReader)
        : async () => new Map(),
      days,
    })
    logger.info({ event: 'analytics.mutation_log.local.done', dir, days })
    return
  }

  await exportMutationLog({
    db: archivalDbReader,
    logsClient,
    s3Client: archiveS3Client,
    appEnv: archivalConfig.appEnv,
    bucket: archivalConfig.analyticsBucket,
    logGroup,
    days,
  })
}

main()
  .then(async () => {
    await archivalDbReader.destroy()
    process.exit(0)
  })
  .catch(async (err) => {
    logger.error({ event: 'analytics.mutation_log.error', err })
    await archivalDbReader.destroy()
    process.exit(1)
  })
