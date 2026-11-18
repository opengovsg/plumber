/**
 * Exports Langfuse sessions to tools/langfuse/data/, newest first.
 *
 * Each row is one session, represented by its last trace.
 * The last trace holds the input and output of the whole conversation.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run export-sessions [options]
 *
 * With no range flags in an interactive terminal, it prompts for each unset option.
 *
 * Options:
 *   --project=aiBuilder|pairAction    default aiBuilder
 *   --environment=prod|staging|uat    default prod
 *   --range=1h|1d|7d|30d|90d|all      default 30d
 *   --from=YYYY-MM-DD --to=YYYY-MM-DD custom range, both days inclusive, local time
 *   --format=json|csv                 default json
 *   --userId=<id>                     only sessions whose last trace belongs to this user
 *   --sessionId=<id>                  export one session and ignore the range
 *   --include=<fields>                comma-separated extras, or all:
 *                                       metrics        latencySeconds, totalCostUsd
 *                                       counts         observationCount, scoreCount
 *                                       metadata       trace metadata
 *                                       fullOutput     raw output instead of the slimmed reply
 *                                       observations   full observations (one extra request per session)
 *                                       scores         full scores (one extra request per session)
 *   --concurrency=<n>                 parallel requests, default 5
 *   --yes                             skip prompts and use defaults
 *
 * Examples:
 *   pnpm run export-sessions
 *   pnpm run export-sessions --range=7d --format=csv
 *   pnpm run export-sessions --range=all
 *   pnpm run export-sessions --range=7d --include=observations,scores
 *   pnpm run export-sessions --from=2026-10-01 --to=2026-10-31 --environment=staging
 */
import { mkdirSync, rmSync } from 'node:fs'

import { resolveOptions } from './lib/cli/options.mjs'
import {
  CLIENT_TIMEOUT_MS,
  EXPORT_DIR_MODE,
  OUT_DIR,
} from './lib/constants.mjs'
import { buildLangfuseClient } from './lib/langfuse/client.mjs'
import { getSession, listSessions } from './lib/langfuse/sessions.mjs'
import { fetchLastTraces } from './lib/langfuse/traces.mjs'
import { buildFields, toRecord } from './lib/output/fields.mjs'
import { buildOutputPath, createWriter } from './lib/output/writer.mjs'
import { describeError } from './lib/utils/errors.mjs'

function printPlan(options) {
  console.log(
    `\nExporting ${options.project} sessions (${options.environment}) as ${options.format}`,
  )
  if (options.sessionId) {
    console.log(`Session: ${options.sessionId}`)
  } else {
    console.log(
      `Range: ${options.range.from?.toISOString() ?? 'all time'} → ${options.range.to.toISOString()}`,
    )
  }
  if (options.userId) {
    console.log(`User: ${options.userId}`)
  }
  console.log(
    `Extra fields: ${options.include.length ? options.include.join(', ') : 'none'}`,
  )
}

/**
 * Lists sessions in the range. A listing failure keeps what was already listed, so a long export is not lost.
 */
async function listAvailableSessions(client, options) {
  const sessions = []
  try {
    await listSessions(client, options, (session) => sessions.push(session))
    return { sessions }
  } catch (error) {
    if (error?.listedBackTo === undefined) {
      throw error
    }
    if (process.stdout.isTTY) {
      process.stdout.write('\n')
    }
    return { sessions, listingError: error }
  }
}

async function writeExport(client, options, sessions, outPath) {
  const fields = buildFields(options.include)
  const baseUrl = (process.env.PAIR_ROME_BASE_URL ?? '').replace(/\/+$/, '')
  const writer = createWriter(
    outPath,
    options.format,
    fields.map(([name]) => name),
  )

  try {
    await writer.start()
    const { failures, skipped } = await fetchLastTraces(
      client,
      sessions,
      options,
      ({ session, trace, traceCount }) =>
        writer.add(toRecord(trace, fields, { baseUrl, session, traceCount })),
    )
    const saved = await writer.end()
    return { saved, failures, skipped }
  } catch (error) {
    // An unexpected error leaves invalid JSON, so drop the file instead of keeping a broken export.
    await writer.end().catch(() => {})
    rmSync(outPath, { force: true })
    throw error
  }
}

function reportResults(
  options,
  outPath,
  { saved, failures, skipped, listingError },
) {
  if (saved === 0 && failures.length === 0) {
    rmSync(outPath)
    console.log(
      listingError ? 'Nothing written.' : 'No sessions found. Nothing written.',
    )
  } else {
    console.log(`Saved ${saved} sessions to ${outPath}`)
  }
  if (skipped > 0) {
    console.warn(
      `Skipped ${skipped} sessions whose last trace is from another environment.`,
    )
  }

  if (listingError) {
    console.error(`\nListing stopped early: ${describeError(listingError)}`)
    console.error(
      `The export only covers ${listingError.listedBackTo.toISOString()} → ${options.range.to.toISOString()}.`,
    )
    process.exitCode = 1
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} sessions failed to download:`)
    for (const { id, message } of failures) {
      console.error(`  ${id}: ${message}`)
    }
    process.exitCode = 1
  }
}

async function main() {
  const options = await resolveOptions(process.argv.slice(2))
  const client = buildLangfuseClient(options.project, process.env, {
    timeout: CLIENT_TIMEOUT_MS,
  })
  printPlan(options)

  // Resolves before the export file opens, so a bad --sessionId or a listing crash leaves no file behind.
  const { sessions, listingError } = options.sessionId
    ? { sessions: [await getSession(client, options)] }
    : await listAvailableSessions(client, options)

  mkdirSync(OUT_DIR, { recursive: true, mode: EXPORT_DIR_MODE })
  const outPath = buildOutputPath(options)
  const result = await writeExport(client, options, sessions, outPath)
  reportResults(options, outPath, { ...result, listingError })
}

main().catch((error) => {
  console.error(`\n${describeError(error)}`)
  process.exit(1)
})
