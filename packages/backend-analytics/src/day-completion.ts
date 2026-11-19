import type { SilverSink } from './export-silver-tables'
import logger from './logger'
import { addSgtDays, sgtDaysAfter } from './sgt-day'
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

// The version and full flag sit in the key, so planning needs one listing and no reads.
export function completionKey(
  job: string,
  { day, version, full }: DayCompletion,
): string {
  return `${COMPLETION_PREFIX}${job}/day=${day}.v${version}${full ? '.full' : ''}.json`
}

export function completionPrefix(job: string): string {
  return `${COMPLETION_PREFIX}${job}/`
}

const COMPLETION_KEY = /\/day=(\d{4}-\d{2}-\d{2})\.v(\d+)(\.full)?\.json$/

export function parseCompletionKey(key: string): DayCompletion | null {
  const match = COMPLETION_KEY.exec(key)
  if (!match) {
    return null
  }
  return { day: match[1], version: Number(match[2]), full: Boolean(match[3]) }
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

function dayStatus(completions: DayCompletion[]): DayStatus {
  const bestVersion = new Map<string, number>()
  for (const { day, version } of completions) {
    bestVersion.set(day, Math.max(version, bestVersion.get(day) ?? 0))
  }
  const earliest = [...bestVersion.keys()].sort()[0] ?? null
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
 * With no completion file yet, only yesterday is planned, so a first run never rewrites history.
 */
export function planDays(
  completions: DayCompletion[],
  yesterday: string,
  version: number,
): { days: string[]; first: boolean } {
  const { firstExpected, bestVersion } = dayStatus(completions)
  if (!firstExpected) {
    return { days: [yesterday], first: true }
  }
  const windowStart = addSgtDays(yesterday, -(MAX_CATCH_UP_DAYS - 1))
  const from = firstExpected > windowStart ? firstExpected : windowStart
  return {
    days: daysFrom(from, yesterday).filter(
      (day) => (bestVersion.get(day) ?? 0) < version,
    ),
    first: false,
  }
}

/**
 * Lists the days in the last COVERAGE_DAYS with no completion file, and those written by an older version.
 *
 * A full copy from an older version counts as stale until a new one is written.
 */
export function checkCoverage(
  completions: DayCompletion[],
  yesterday: string,
  version: number,
): { missing: string[]; stale: string[] } {
  const { firstExpected, bestVersion, lastFull } = dayStatus(completions)
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

export function readCompletions(keys: string[]): DayCompletion[] {
  return keys
    .map(parseCompletionKey)
    .filter((completion): completion is DayCompletion => completion !== null)
}

function logCoverage(
  job: string,
  completions: DayCompletion[],
  yesterday: string,
  version: number,
): void {
  const { missing, stale } = checkCoverage(completions, yesterday, version)
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
    listCompletions,
  }: {
    job: string
    yesterday: string
    version: number
    listCompletions: () => Promise<DayCompletion[]>
  },
  run: (completions: DayCompletion[]) => Promise<void>,
): Promise<void> {
  const before = await listCompletions()
  try {
    await run(before)
  } finally {
    // A failed listing must not replace the export's own error.
    const after = await listCompletions().catch(() => before)
    logCoverage(job, after, yesterday, version)
  }
}
