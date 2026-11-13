import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  exportSilverTables,
  localDirSink,
  SILVER_CHANGE_TABLES,
  SILVER_TABLES,
  selectSilverTables,
  writeAllSilverTables,
} from '@/helpers/analytics/export-silver-tables'
import { localDirKeyLister } from '@/helpers/analytics/silver-change-tables'
import { archivalConfig } from '@/helpers/archival/config'
import { archivalDbReader } from '@/helpers/archival/db'
import logger from '@/helpers/archival/logger'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const USAGE = `Usage: analytics:export [--tables a,b] [--full] (--out <dir> | --s3)
  --tables  Comma-separated silver tables. Default: all.
  --full    Write each change table, such as flow_step, as a full copy. Use after a direct database write.
  --out     Write the files under this local folder. Runs in any APP_ENV.
  --s3      Write to ANALYTICS_BUCKET, exactly as the nightly job does. Prod and staging only.`

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tables: { type: 'string' },
      out: { type: 'string' },
      s3: { type: 'boolean', default: false },
      full: { type: 'boolean', default: false },
    },
  })
  if (Boolean(values.out) === values.s3) {
    throw new Error(USAGE)
  }

  const { tables, changeTables } = values.tables
    ? selectSilverTables(values.tables.split(',').map((name) => name.trim()))
    : { tables: SILVER_TABLES, changeTables: SILVER_CHANGE_TABLES }

  if (values.out) {
    const dir = path.resolve(values.out)
    await writeAllSilverTables({
      db: archivalDbReader,
      tables,
      changeTables,
      full: values.full,
      sink: localDirSink(dir),
      listKeys: localDirKeyLister(dir),
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
    changeTables,
    full: values.full,
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
