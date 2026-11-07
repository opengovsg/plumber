import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  exportSilverTables,
  localDirSink,
  SILVER_TABLES,
  selectSilverTables,
  writeSilverTables,
} from '@/helpers/analytics/export-silver-tables'
import { archivalConfig } from '@/helpers/archival/config'
import { archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const USAGE = `Usage: analytics:export [--tables a,b] (--out <dir> | --s3)
  --tables  Comma-separated silver tables. Default: all.
  --out     Write the files under this local folder. Runs in any APP_ENV.
  --s3      Write to ANALYTICS_BUCKET, exactly as the nightly job does. Prod and staging only.`

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tables: { type: 'string' },
      out: { type: 'string' },
      s3: { type: 'boolean', default: false },
    },
  })
  if (Boolean(values.out) === values.s3) {
    throw new Error(USAGE)
  }

  const tables = values.tables
    ? selectSilverTables(values.tables.split(',').map((name) => name.trim()))
    : SILVER_TABLES

  if (values.out) {
    const dir = path.resolve(values.out)
    await writeSilverTables({
      db: archivalDbReader,
      tables,
      sink: localDirSink(dir),
    })
    logger.info({ event: 'analytics.export.local.done', dir })
    return
  }

  await exportSilverTables({
    db: archivalDbReader,
    s3Client: archiveS3Client,
    appEnv: archivalConfig.appEnv,
    bucket: archivalConfig.analyticsBucket,
    tables,
  })
}

main()
  .then(async () => {
    await archivalDbReader.destroy()
    process.exit(0)
  })
  .catch(async (err) => {
    logger.error({ event: 'analytics.export.error', err })
    await archivalDbReader.destroy()
    process.exit(1)
  })
