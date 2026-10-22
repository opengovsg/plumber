import { DateTime } from 'luxon'

import appConfig from '@/config/app'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'

const NIGHTLY_WINDOW_START_HOUR = 1
const NIGHTLY_WINDOW_END_HOUR = 5

export type RunNightlyResult = 'flag-off' | 'outside-window' | 'ran'

export function isWithinNightlyWindow(now: Date): boolean {
  // IMPORTANT: set the zone explicitly. The Luxon default zone depends on config/app loading first.
  const hour = DateTime.fromJSDate(now).setZone('Asia/Singapore').hour
  return hour >= NIGHTLY_WINDOW_START_HOUR && hour < NIGHTLY_WINDOW_END_HOUR
}

// getLdFlagValue rejects when the LD client cannot initialize, e.g. on .env-example.
async function readFlag<T extends string | boolean>(
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

export async function runNightly(): Promise<RunNightlyResult> {
  const mode = await readFlag<string>('tiles-ddb-migration', 'off')
  if (mode !== 'migrate') {
    logger.info('tiles-migration.run.skipped', { reason: 'flag-off', mode })
    return 'flag-off'
  }

  const ignoreWindow = appConfig.isProd
    ? false
    : await readFlag('tiles-ddb-migration-ignore-window', appConfig.isDev)
  if (!ignoreWindow && !isWithinNightlyWindow(new Date())) {
    logger.info('tiles-migration.run.skipped', { reason: 'outside-window' })
    return 'outside-window'
  }

  return 'ran'
}
