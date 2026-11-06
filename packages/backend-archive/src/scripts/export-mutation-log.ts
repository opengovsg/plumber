import path from 'node:path'
import { parseArgs } from 'node:util'

import { localDirSink } from '@/helpers/analytics/export-silver-tables'
import {
  exportMutationLog,
  logsInsightsFetcher,
  sgtDaysBetween,
  writeMutationLogDays,
} from '@/helpers/analytics/mutation-log/export-mutation-log'
import { logsClient } from '@/helpers/analytics/mutation-log/logs-client'
import { archivalConfig } from '@/helpers/archival/config'
import logger from '@/helpers/archival/logger'
import { archiveS3Client } from '@/helpers/archival/s3-client'

const USAGE = `Usage: analytics:mutation-log --from YYYY-MM-DD [--to YYYY-MM-DD] [--log-group <name>] (--out <dir> | --s3)
  --from       First Singapore day to extract.
  --to         Last Singapore day, inclusive. Default: --from.
  --log-group  Server log group. Default: ANALYTICS_REQUEST_LOG_GROUP.
  --out        Write the files under this local folder. Runs in any APP_ENV.
  --s3         Write to ANALYTICS_BUCKET, exactly as the nightly job does. Prod and staging only.`

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
  const logGroup =
    values['log-group'] ?? archivalConfig.analyticsRequestLogGroup

  if (values.out) {
    if (!logGroup) {
      throw new Error(USAGE)
    }
    const dir = path.resolve(values.out)
    await writeMutationLogDays({
      fetchDayLines: logsInsightsFetcher(logsClient, logGroup),
      sink: localDirSink(dir),
      days,
    })
    logger.info({ event: 'analytics.mutation_log.local.done', dir, days })
    return
  }

  await exportMutationLog({
    logsClient,
    s3Client: archiveS3Client,
    appEnv: archivalConfig.appEnv,
    bucket: archivalConfig.analyticsBucket,
    logGroup,
    days,
  })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ event: 'analytics.mutation_log.error', err })
    process.exit(1)
  })
