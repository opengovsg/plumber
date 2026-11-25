import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  backfillExecutionDays,
  claimLocalExportDir,
  EXECUTION_DAY_TABLES,
  exportExecutionHistory,
  localDirCompletionStore,
  localDirSink,
  sgtDaysBetween,
} from 'backend-analytics'

import { archivalConfig } from '@/helpers/archival/config'
import { archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const USAGE = `Usage: analytics:execution-history --from YYYY-MM-DD [--to YYYY-MM-DD] [--tables a,b] (--out <dir> | --s3)
  --from    First Singapore day to write.
  --to      Last Singapore day, inclusive. Default: --from. At most the day before yesterday, the last final day.
  --tables  execution_daily, execution_step_daily or both. Default: both.
  --out     Write the files under this local folder. Runs in any APP_ENV.
  --s3      Write to ANALYTICS_BUCKET. Prod and staging only.
Days already final are skipped, so a rerun resumes where a stopped run left off.`

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      tables: { type: 'string' },
      out: { type: 'string' },
      s3: { type: 'boolean', default: false },
    },
  })
  if (!values.from || Boolean(values.out) === values.s3) {
    throw new Error(USAGE)
  }
  const names = values.tables?.split(',').map((name) => name.trim())
  const dayTables = names
    ? EXECUTION_DAY_TABLES.filter((table) => names.includes(table.name))
    : EXECUTION_DAY_TABLES
  if (names && dayTables.length !== names.length) {
    throw new Error(USAGE)
  }
  const days = sgtDaysBetween(values.from, values.to ?? values.from)

  if (values.out) {
    const dir = path.resolve(values.out)
    await claimLocalExportDir(dir, {
      appEnv: archivalConfig.appEnv,
      host: archivalConfig.postgresReaderHost,
      database: archivalConfig.postgresDatabase,
    })
    await backfillExecutionDays({
      db: archivalDbReader,
      sink: localDirSink(dir),
      store: localDirCompletionStore(dir),
      days,
      dayTables,
    })
    logger.info({ event: 'analytics.execution_history.local.done', dir })
    return
  }

  await exportExecutionHistory({
    db: archivalDbReader,
    s3Client: archiveS3Client,
    appEnv: archivalConfig.appEnv,
    bucket: archivalConfig.analyticsBucket,
    days,
    dayTables,
  })
}

main()
  .then(async () => {
    await archivalDbReader.destroy()
    process.exit(0)
  })
  .catch(async (err) => {
    logger.error({ event: 'analytics.execution_history.error', err })
    await archivalDbReader.destroy()
    process.exit(1)
  })
