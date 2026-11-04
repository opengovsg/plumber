import { DateTime } from 'luxon'
import pLimit from 'p-limit'
import { z } from 'zod'

import appConfig from '@/config/app'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import TableMetadata from '@/models/table-metadata'

import { migrateTable, type MigrateTableOptions } from './migrate-table'
import { type RunReport, sendReportEmail } from './report-email'

const NIGHTLY_WINDOW_START_HOUR = 1
const NIGHTLY_WINDOW_END_HOUR = 5
const CANDIDATE_PAGE_SIZE = 50
const MIGRATION_CONCURRENCY = 2

// Returned as the BullMQ job result, so bull-board shows each run's counts.
export type RunNightlyResult =
  | { status: 'flag-off' | 'outside-window' }
  | ({ status: 'ran' } & RunReport)

export function isWithinNightlyWindow(now: Date): boolean {
  // IMPORTANT: set the zone explicitly. The Luxon default zone depends on config/app loading first.
  const hour = DateTime.fromJSDate(now).setZone('Asia/Singapore').hour
  return hour >= NIGHTLY_WINDOW_START_HOUR && hour < NIGHTLY_WINDOW_END_HOUR
}

// getLdFlagValue rejects when the LD client cannot initialize, e.g. on .env-example.
async function readFlag<T extends string | boolean | number>(
  flag: string,
  fallback: T,
): Promise<T> {
  try {
    return await getLdFlagValue<T>(flag, null, fallback)
  } catch (err) {
    logger.warn('tiles-migration.flag.unavailable', {
      flag,
      err: (err as Error).message,
    })
    return fallback
  }
}

function readMode(): Promise<string> {
  return readFlag<string>('tiles-ddb-migration', 'off')
}

async function isFlagOn(): Promise<boolean> {
  return (await readMode()) === 'migrate'
}

// Caps tables claimed per night, so the rollout starts small. Unset means no cap.
async function readMaxTables(): Promise<number> {
  return z
    .union([z.number().int().nonnegative(), z.literal(Infinity)])
    .catch(0)
    .parse(await readFlag('tiles-ddb-migration-max-tables', Infinity))
}

async function migrateAll(
  canStart: () => Promise<boolean>,
  drain: MigrateTableOptions['drain'],
  maxTables: number,
): Promise<RunReport> {
  const counts = { migrated: 0, skipped: 0, aborted: 0, failed: 0 }
  const failedTableIds: string[] = []
  const abortedTableIds: string[] = []
  const limit = pLimit(MIGRATION_CONCURRENCY)
  const runs: Promise<void>[] = []
  let stopped = false
  let claimed = 0
  let lastId = ''
  while (!stopped) {
    const ids = (
      await TableMetadata.query()
        .select('id')
        .where({ db: 'ddb' })
        .modify((query) => {
          if (lastId) {
            query.where('id', '>', lastId)
          }
        })
        .orderBy('id')
        .limit(CANDIDATE_PAGE_SIZE)
    ).map((table) => table.id)
    if (!ids.length) {
      break
    }
    lastId = ids[ids.length - 1]
    for (const tableId of ids) {
      runs.push(
        limit(async () => {
          // IMPORTANT: a callback can wait in pLimit past 05:00 or a flag change.
          if (stopped || !(await canStart())) {
            stopped = true
            return
          }
          // IMPORTANT: no await between this check and the increment, or concurrent callbacks overshoot.
          // A skipped tile frees its slot for a later candidate.
          if (claimed >= maxTables) {
            return
          }
          claimed++
          try {
            const result = await migrateTable(tableId, { isFlagOn, drain })
            counts[result]++
            if (result === 'skipped') {
              claimed--
            }
            if (result === 'failed') {
              failedTableIds.push(tableId)
            } else if (result === 'aborted') {
              abortedTableIds.push(tableId)
            }
          } catch (err) {
            counts.failed++
            failedTableIds.push(tableId)
            logger.error('tiles-migration.table.failed', {
              tableId,
              err: (err as Error).message,
            })
          }
        }),
      )
    }
  }
  await Promise.all(runs)

  const remaining = await TableMetadata.query()
    .where({ db: 'ddb' })
    .whereRaw(`(config->>'ddbMigrationExcluded') IS DISTINCT FROM 'true'`)
    .resultSize()
  logger.info('tiles-migration.run.completed', { ...counts, remaining })
  return { ...counts, remaining, failedTableIds, abortedTableIds }
}

export async function runNightly({
  drain,
}: Pick<MigrateTableOptions, 'drain'> = {}): Promise<RunNightlyResult> {
  const mode = await readMode()
  if (mode !== 'migrate') {
    logger.info('tiles-migration.run.skipped', { reason: 'flag-off', mode })
    return { status: 'flag-off' }
  }

  const ignoreWindow = appConfig.isProd
    ? false
    : await readFlag('tiles-ddb-migration-ignore-window', appConfig.isDev)
  const isWindowOpen = () => ignoreWindow || isWithinNightlyWindow(new Date())
  if (!isWindowOpen()) {
    logger.info('tiles-migration.run.skipped', { reason: 'outside-window' })
    return { status: 'outside-window' }
  }

  const report = await migrateAll(
    async () => isWindowOpen() && (await isFlagOn()),
    drain,
    await readMaxTables(),
  )
  await sendReportEmail(report)
  return { status: 'ran', ...report }
}
