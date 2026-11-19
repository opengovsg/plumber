import type { SilverSink } from './export-silver-tables'
import logger from './logger'
import { addSgtDays, isSgtDay, sgtDaysAfter } from './sgt-day'
import { BRONZE_PREFIX } from './silver-table'

// Under bronze because the archival role can write only bronze/ and silver/, and PostHog reads only silver/.
export const COMPLETION_PREFIX = `${BRONZE_PREFIX}_completion/`

// Each mutation log day costs one Logs Insights scan and runs before archival, so older gaps alert instead.
export const MAX_CATCH_UP_DAYS = 7

export const COVERAGE_DAYS = 30

export interface DayCompletion {
  day: string
  version: number
  // A full copy covers every earlier day, so older days are never redone or reported.
  full: boolean
}

export interface JobState {
  completions: DayCompletion[]
  // The day the job first ran, so a first run that fails is still owed.
  startDay: string | null
}

// The version and full flag sit in the key, so planning needs one listing and no reads.
export function completionKey(
  job: string,
  { day, version, full }: DayCompletion,
): string {
  return `${COMPLETION_PREFIX}${job}/day=${day}.v${version}${full ? '.full' : ''}.json`
}

export function startKey(job: string, day: string): string {
  return `${COMPLETION_PREFIX}${job}/start=${day}.json`
}

export function completionPrefix(job: string): string {
  return `${COMPLETION_PREFIX}${job}/`
}

const COMPLETION_KEY = /\/day=(\d{4}-\d{2}-\d{2})\.v(\d+)(\.full)?\.json$/
const START_KEY = /\/start=(\d{4}-\d{2}-\d{2})\.json$/

// A key with an impossible date is ignored, so it cannot break planning.
export function parseCompletionKey(key: string): DayCompletion | null {
  const match = COMPLETION_KEY.exec(key)
  if (!match || !isSgtDay(match[1])) {
    return null
  }
  return { day: match[1], version: Number(match[2]), full: Boolean(match[3]) }
}

export function readJobState(keys: string[]): JobState {
  const startDays = keys
    .map((key) => START_KEY.exec(key)?.[1])
    .filter((day): day is string => day !== undefined && isSgtDay(day))
    .sort()
  return {
    completions: keys
      .map(parseCompletionKey)
      .filter((completion): completion is DayCompletion => completion !== null),
    startDay: startDays[0] ?? null,
  }
}

function daysFrom(from: string, through: string): string[] {
  return sgtDaysAfter(addSgtDays(from, -1), through)
}

interface DayStatus {
  // Days before this are history or covered by a full copy.
  firstExpected: string | null
  bestVersion: Map<string, number>
  lastFull: DayCompletion | undefined
}

export function latestFullCopy(
  completions: DayCompletion[],
): DayCompletion | undefined {
  return completions
    .filter((completion) => completion.full)
    .sort((a, b) => a.day.localeCompare(b.day) || a.version - b.version)
    .at(-1)
}

function dayStatus({ completions, startDay }: JobState): DayStatus {
  const bestVersion = new Map<string, number>()
  for (const { day, version } of completions) {
    bestVersion.set(day, Math.max(version, bestVersion.get(day) ?? 0))
  }
  const earliest =
    [...bestVersion.keys(), ...(startDay ? [startDay] : [])].sort()[0] ?? null
  const lastFull = latestFullCopy(completions)
  const afterFull = lastFull ? addSgtDays(lastFull.day, 1) : null
  return {
    firstExpected:
      earliest && afterFull && afterFull > earliest ? afterFull : earliest,
    bestVersion,
    lastFull,
  }
}

/**
 * Picks the days in the last MAX_CATCH_UP_DAYS, through yesterday, that have no completion file at the current version.
 *
 * With no start marker or completion file yet, only yesterday is planned, so a first run never rewrites history.
 */
export function planDays(
  state: JobState,
  yesterday: string,
  version: number,
): { days: string[]; first: boolean } {
  const { firstExpected, bestVersion } = dayStatus(state)
  const first = state.completions.length === 0
  if (!firstExpected) {
    return { days: [yesterday], first }
  }
  const windowStart = addSgtDays(yesterday, -(MAX_CATCH_UP_DAYS - 1))
  const from = firstExpected > windowStart ? firstExpected : windowStart
  return {
    days: daysFrom(from, yesterday).filter(
      (day) => (bestVersion.get(day) ?? 0) < version,
    ),
    first,
  }
}

/**
 * Lists the days in the last COVERAGE_DAYS with no completion file, and those written by an older version.
 *
 * A full copy from an older version counts as stale until a new one is written.
 */
export function checkCoverage(
  state: JobState,
  yesterday: string,
  version: number,
): { missing: string[]; stale: string[] } {
  const { firstExpected, bestVersion, lastFull } = dayStatus(state)
  if (!firstExpected) {
    return { missing: [], stale: [] }
  }
  const windowStart = addSgtDays(yesterday, -(COVERAGE_DAYS - 1))
  const from = firstExpected > windowStart ? firstExpected : windowStart
  const days = daysFrom(from, yesterday)
  const staleBaseline =
    lastFull && lastFull.version < version ? [lastFull.day] : []
  return {
    missing: days.filter((day) => !bestVersion.has(day)),
    stale: [
      ...staleBaseline,
      ...days.filter((day) => {
        const best = bestVersion.get(day)
        return best !== undefined && best < version
      }),
    ],
  }
}

export type CompletionSource = 'nightly' | 'backfill'

/**
 * Marks a day done. Write it only after every output of the day is written.
 */
export async function markDayComplete({
  sink,
  job,
  completion,
  source,
  outputs,
}: {
  sink: SilverSink
  job: string
  completion: DayCompletion
  source: CompletionSource
  outputs: string[]
}): Promise<void> {
  const body = Buffer.from(
    JSON.stringify({
      job,
      ...completion,
      source,
      outputs,
      writtenAt: new Date().toISOString(),
    }),
  )
  await sink(completionKey(job, completion), body)
}

function logCoverage(
  job: string,
  state: JobState,
  yesterday: string,
  version: number,
): void {
  const { missing, stale } = checkCoverage(state, yesterday, version)
  logger.info({
    event: 'analytics.export.coverage',
    job,
    missingDays: missing.length,
    firstMissing: missing[0] ?? null,
    lastMissing: missing.at(-1) ?? null,
    staleDays: stale.length,
  })
}

/**
 * Runs a job's export and always logs its coverage afterwards, which the missing-days monitor reads.
 *
 * IMPORTANT: coverage is logged even when the export throws, because a failed catch-up is when gaps need reporting.
 */
export async function runWithCoverage(
  {
    job,
    yesterday,
    version,
    listKeys,
    sink,
  }: {
    job: string
    yesterday: string
    version: number
    listKeys: (prefix: string) => Promise<string[]>
    sink: SilverSink
  },
  run: (state: JobState) => Promise<void>,
): Promise<void> {
  const readState = async () =>
    readJobState(await listKeys(completionPrefix(job)))
  let before: JobState | null = null
  try {
    before = await readState()
    if (!before.startDay && before.completions.length === 0) {
      await sink(
        startKey(job, yesterday),
        Buffer.from(JSON.stringify({ job, startDay: yesterday })),
      )
      before = { ...before, startDay: yesterday }
    }
    await run(before)
  } finally {
    // A failed listing must not replace the export's own error.
    const after = await readState().catch(() => before)
    if (after) {
      logCoverage(job, after, yesterday, version)
    } else {
      logger.error({ event: 'analytics.export.coverage.unavailable', job })
    }
  }
}

/**
 * Writes each planned day, so one failing day does not hold back later ones.
 *
 * A failed day stays unmarked for the next run. The run still fails, so the export alert fires.
 */
export async function writeEachDay<Item>(
  job: string,
  items: Item[],
  dayOf: (item: Item) => string,
  write: (item: Item) => Promise<void>,
): Promise<void> {
  const failed: string[] = []
  for (const item of items) {
    try {
      await write(item)
    } catch (err) {
      failed.push(dayOf(item))
      logger.error({
        event: 'analytics.export.day.error',
        job,
        day: dayOf(item),
        err,
      })
    }
  }
  if (failed.length > 0) {
    throw new Error(
      `${job}: ${failed.length} day(s) failed: ${failed.join(', ')}`,
    )
  }
}
