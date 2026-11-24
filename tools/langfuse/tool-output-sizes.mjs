/**
 * Reports AI Builder tool output sizes and per-call model input tokens from Langfuse.
 *
 * Sizes the shape-preserving tool output caps and the compaction token threshold.
 * Reads observations directly, because a session's last trace holds only the last turn.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run tool-output-sizes [--environment=prod] [--days=30]
 */
import { buildLangfuseClient } from './lib/client.mjs'
import {
  CLIENT_TIMEOUT_MS,
  PAGE_SIZE,
  REQUEST_OPTIONS,
} from './lib/constants.mjs'

const WINDOW_MS = 6 * 3_600_000
const TOP_N = 10

function readFlag(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : fallback
}

async function* listObservations(client, query, from, to) {
  // IMPORTANT: Rome times out on large queries, so walk the range in small windows.
  for (let start = from.getTime(); start < to.getTime(); start += WINDOW_MS) {
    const end = Math.min(start + WINDOW_MS, to.getTime())
    for (let page = 1; ; page++) {
      const response = await client.api.observations.getMany(
        {
          ...query,
          page,
          limit: PAGE_SIZE,
          fromStartTime: new Date(start).toISOString(),
          toStartTime: new Date(end).toISOString(),
        },
        REQUEST_OPTIONS,
      )
      yield* response.data
      if (page >= response.meta.totalPages) {
        break
      }
    }
  }
}

// AI SDK tool spans carry the tool name as an OTel attribute, which Langfuse keeps in metadata.
function toolNameOf(observation) {
  const attributes =
    observation.metadata?.attributes ?? observation.metadata ?? {}
  return attributes['ai.toolCall.name'] ?? observation.name
}

function byteSize(value) {
  if (value === null || value === undefined) {
    return 0
  }
  return Buffer.byteLength(
    typeof value === 'string' ? value : JSON.stringify(value),
  )
}

// Uncached input, cache reads and cache writes are all separate "input*" usage keys.
function inputTokensOf(observation) {
  const usage = observation.usageDetails ?? {}
  return Object.entries(usage)
    .filter(([key]) => key.startsWith('input'))
    .reduce((sum, [, tokens]) => sum + (Number(tokens) || 0), 0)
}

function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0
  }
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ]
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    max: sorted.at(-1) ?? 0,
  }
}

async function collect(client, primary, fallback, from, to, onObservation) {
  let seen = 0
  for await (const observation of listObservations(client, primary, from, to)) {
    seen++
    onObservation(observation)
  }
  if (seen === 0 && fallback) {
    console.log(
      `No observations for ${JSON.stringify(primary)}. Trying ${JSON.stringify(fallback)}.`,
    )
    for await (const observation of listObservations(
      client,
      fallback,
      from,
      to,
    )) {
      onObservation(observation)
    }
  }
}

async function main() {
  const environment = readFlag('environment', 'prod')
  const days = Number(readFlag('days', '30'))
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 3_600_000)
  const client = buildLangfuseClient('aiBuilder', process.env, {
    timeout: CLIENT_TIMEOUT_MS,
  })

  console.log(
    `AI Builder ${environment}, ${from.toISOString()} to ${to.toISOString()}\n`,
  )

  const sizesByTool = new Map()
  const largest = []
  await collect(
    client,
    { name: 'ai.toolCall', environment },
    { type: 'TOOL', environment },
    from,
    to,
    (observation) => {
      const tool = toolNameOf(observation)
      const bytes = byteSize(observation.output)
      if (!sizesByTool.has(tool)) {
        sizesByTool.set(tool, [])
      }
      sizesByTool.get(tool).push(bytes)
      largest.push({ tool, bytes, traceId: observation.traceId })
    },
  )

  console.log('Tool output bytes')
  console.table(
    Object.fromEntries(
      [...sizesByTool.entries()].map(([tool, sizes]) => [
        tool,
        {
          ...summarize(sizes),
          over20KB: sizes.filter((b) => b > 20_000).length,
          over100KB: sizes.filter((b) => b > 100_000).length,
        },
      ]),
    ),
  )
  console.log(`\nLargest ${TOP_N} tool outputs`)
  console.table(largest.sort((a, b) => b.bytes - a.bytes).slice(0, TOP_N))

  const inputTokens = []
  await collect(
    client,
    { name: 'ai.streamText.doStream', environment },
    { type: 'GENERATION', environment },
    from,
    to,
    (observation) => inputTokens.push(inputTokensOf(observation)),
  )
  console.log(
    '\nInput tokens per model call (uncached + cache read + cache write)',
  )
  console.table({ modelCall: summarize(inputTokens) })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
