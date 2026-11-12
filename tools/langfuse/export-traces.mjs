import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

/**
 * Exports full Langfuse traces (with observations and scores) to tools/langfuse/data/.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run export-traces [options]
 *
 * With no range flags in an interactive terminal, it prompts for each unset option.
 *
 * Options:
 *   --project=aiBuilder|pairAction    default aiBuilder
 *   --environment=prod|staging|uat    default prod
 *   --range=1d|7d|30d|90d             default 30d
 *   --from=YYYY-MM-DD --to=YYYY-MM-DD custom range, both days inclusive, local time
 *   --format=json|csv                 default json
 *   --userId=<id>                     only traces for this user
 *   --traceId=<id>                    export one trace and ignore the range
 *   --concurrency=<n>                 parallel trace fetches, default 5
 *   --yes                             skip prompts and use defaults
 *
 * Examples:
 *   pnpm run export-traces
 *   pnpm run export-traces --range=7d --format=csv
 *   pnpm run export-traces --from=2026-10-01 --to=2026-10-31 --environment=staging
 */
import { buildLangfuseClient, PROJECTS } from './client.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'data')

const ENVIRONMENTS = ['prod', 'staging', 'uat']
const FORMATS = ['json', 'csv']
const RANGES = [
  { key: '1d', label: 'Last 1 day', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
]
const DEFAULT_RANGE = '30d'
// Langfuse caps list endpoints at 100 items per page.
const PAGE_SIZE = 100
const REQUEST_OPTIONS = { maxRetries: 4, timeoutInSeconds: 60 }
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function fail(message) {
  throw new Error(message)
}

function oneOf(flag, value, allowed) {
  if (!allowed.includes(value)) {
    fail(`--${flag} must be one of ${allowed.join(', ')}. Got "${value}".`)
  }
  return value
}

function parseFlags(argv) {
  const flags = {}
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!match) {
      fail(`Unexpected argument "${arg}". Flags use the form --name=value.`)
    }
    flags[match[1]] = match[2] ?? true
  }
  return flags
}

function parseDate(flag, value) {
  if (!DATE_PATTERN.test(value)) {
    fail(`--${flag} must use the format YYYY-MM-DD. Got "${value}".`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Rejects dates like 2026-02-31, which Date silently rolls over.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    fail(`--${flag} is not a real date: "${value}".`)
  }
  return date
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function rangeFromDays(days, now = new Date()) {
  return { from: new Date(now.getTime() - days * 86_400_000), to: now }
}

function customRange(fromValue, toValue) {
  const to = toValue ? addDays(parseDate('to', toValue), 1) : new Date()
  const from = fromValue
    ? parseDate('from', fromValue)
    : new Date(to.getTime() - 30 * 86_400_000)
  if (from >= to) {
    fail('--from must be on or before --to.')
  }
  return { from, to }
}

async function ask(rl, question, options, defaultKey) {
  console.log(`\n${question}`)
  options.forEach((option, index) => {
    const marker = option.key === defaultKey ? ' (default)' : ''
    console.log(`  ${index + 1}) ${option.label}${marker}`)
  })
  for (;;) {
    const answer = (await rl.question('> ')).trim()
    if (answer === '') {
      return defaultKey
    }
    const option = options[Number(answer) - 1]
    if (option) {
      return option.key
    }
    console.log(`Enter a number from 1 to ${options.length}.`)
  }
}

async function askDate(rl, label, defaultValue) {
  for (;;) {
    const answer = (
      await rl.question(`${label} (YYYY-MM-DD, default ${defaultValue}): `)
    ).trim()
    const value = answer || defaultValue
    try {
      parseDate(label, value)
      return value
    } catch (error) {
      console.log(error.message)
    }
  }
}

async function promptForMissing(flags) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answers = { ...flags }
    const toOptions = (values) => values.map((v) => ({ key: v, label: v }))

    answers.project ??= await ask(
      rl,
      'Project:',
      toOptions(PROJECTS),
      'aiBuilder',
    )
    answers.environment ??= await ask(
      rl,
      'Environment:',
      toOptions(ENVIRONMENTS),
      'prod',
    )

    const rangeKey = await ask(
      rl,
      'Date range:',
      [...RANGES, { key: 'custom', label: 'Custom date range' }],
      DEFAULT_RANGE,
    )
    if (rangeKey === 'custom') {
      const today = formatDate(new Date())
      answers.from = await askDate(
        rl,
        'Start date',
        formatDate(addDays(new Date(), -30)),
      )
      answers.to = await askDate(rl, 'End date', today)
    } else {
      answers.range = rangeKey
    }

    answers.format ??= await ask(rl, 'Format:', toOptions(FORMATS), 'json')
    return answers
  } finally {
    rl.close()
  }
}

async function resolveOptions(argv) {
  let flags = parseFlags(argv)

  const hasRangeFlag = flags.range || flags.from || flags.to || flags.traceId
  if (!hasRangeFlag && !flags.yes && process.stdin.isTTY) {
    flags = await promptForMissing(flags)
  }

  if (flags.range && (flags.from || flags.to)) {
    fail('--range cannot be combined with --from or --to.')
  }

  const concurrency = Number(flags.concurrency ?? 5)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    fail('--concurrency must be a positive integer.')
  }

  let range
  if (flags.from || flags.to) {
    range = customRange(flags.from, flags.to)
  } else {
    const key = oneOf(
      'range',
      flags.range ?? DEFAULT_RANGE,
      RANGES.map((r) => r.key),
    )
    range = rangeFromDays(RANGES.find((r) => r.key === key).days)
  }

  return {
    project: oneOf('project', flags.project ?? 'aiBuilder', PROJECTS),
    environment: oneOf(
      'environment',
      flags.environment ?? 'prod',
      ENVIRONMENTS,
    ),
    format: oneOf('format', flags.format ?? 'json', FORMATS),
    userId: typeof flags.userId === 'string' ? flags.userId : undefined,
    traceId: typeof flags.traceId === 'string' ? flags.traceId : undefined,
    concurrency,
    range,
  }
}

function createProgress(label) {
  const isTTY = process.stdout.isTTY
  const startedAt = Date.now()
  let lastLogged = 0

  return {
    update(done, total) {
      const elapsed = (Date.now() - startedAt) / 1000
      const rate = done / Math.max(elapsed, 0.001)
      const eta = rate > 0 ? Math.round((total - done) / rate) : 0
      const pct = total ? Math.floor((done / total) * 100) : 100
      const etaText =
        eta >= 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`
      const line = `${label}: ${done}/${total} (${pct}%) · ${rate.toFixed(1)}/s · ETA ${etaText}`
      if (isTTY) {
        process.stdout.write(`\r${line}\x1b[K`)
      } else if (Date.now() - lastLogged > 5000 || done === total) {
        // Non-TTY output (CI, piped logs) cannot rewrite lines, so throttle instead.
        console.log(line)
        lastLogged = Date.now()
      }
    },
    finish() {
      if (isTTY) {
        process.stdout.write('\n')
      }
    },
  }
}

async function listTraceIds(client, options) {
  const ids = new Set()
  let page = 1
  let totalPages = 1
  let totalItems = 0
  let mismatchedEnvironment = 0
  let missingEnvironment = 0

  do {
    const response = await client.api.trace.list(
      {
        page,
        limit: PAGE_SIZE,
        orderBy: 'timestamp.asc',
        fromTimestamp: options.range.from.toISOString(),
        toTimestamp: options.range.to.toISOString(),
        environment: options.environment,
        userId: options.userId,
      },
      REQUEST_OPTIONS,
    )
    totalPages = response.meta.totalPages
    totalItems = response.meta.totalItems

    for (const trace of response.data) {
      // Older Langfuse servers ignore the environment filter, so verify each trace.
      if (trace.environment === undefined) {
        missingEnvironment++
      } else if (trace.environment !== options.environment) {
        mismatchedEnvironment++
        continue
      }
      ids.add(trace.id)
    }

    const line = `Listing traces: page ${page}/${Math.max(totalPages, 1)} · ${ids.size} found`
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${line}\x1b[K`)
    } else {
      console.log(line)
    }
    page++
  } while (page <= totalPages)
  if (process.stdout.isTTY) {
    process.stdout.write('\n')
  }

  if (mismatchedEnvironment > 0) {
    console.warn(
      `Skipped ${mismatchedEnvironment} of ${totalItems} traces from other environments. The server ignored the environment filter.`,
    )
  }
  if (missingEnvironment > 0) {
    console.warn(
      `WARNING: ${missingEnvironment} traces have no environment field. They may come from any environment.`,
    )
  }

  return [...ids]
}

/**
 * Runs fetches in parallel but hands results to `onResult` in input order.
 *
 * Keeps output sorted by timestamp without holding every trace in memory.
 */
async function fetchInOrder(ids, concurrency, fetchOne, onResult) {
  const pending = new Map()
  let nextToFetch = 0
  let nextToEmit = 0
  // IMPORTANT: only one drain may run at a time, or writes from two workers interleave.
  let draining = false

  async function drain() {
    if (draining) {
      return
    }
    draining = true
    try {
      while (pending.has(nextToEmit)) {
        const result = pending.get(nextToEmit)
        pending.delete(nextToEmit)
        nextToEmit++
        await onResult(result)
      }
    } finally {
      draining = false
    }
  }

  async function worker() {
    while (nextToFetch < ids.length) {
      const index = nextToFetch++
      pending.set(index, await fetchOne(ids[index]))
      await drain()
    }
    await drain()
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker),
  )
}

const CSV_COLUMNS = [
  ['id', (t) => t.id],
  ['timestamp', (t) => t.timestamp],
  ['name', (t) => t.name],
  ['environment', (t) => t.environment],
  ['userId', (t) => t.userId],
  ['sessionId', (t) => t.sessionId],
  ['release', (t) => t.release],
  ['version', (t) => t.version],
  ['tags', (t) => t.tags],
  ['latencySeconds', (t) => t.latency],
  ['totalCostUsd', (t) => t.totalCost],
  ['observationCount', (t) => t.observations?.length ?? 0],
  ['scoreCount', (t) => t.scores?.length ?? 0],
  ['htmlPath', (t) => t.htmlPath],
  ['input', (t) => t.input],
  ['output', (t) => t.output],
  ['metadata', (t) => t.metadata],
  ['observations', (t) => t.observations],
  ['scores', (t) => t.scores],
]

function toCsvCell(value) {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function createWriter(path, format) {
  const stream = createWriteStream(path, 'utf-8')
  let count = 0

  const write = (chunk) =>
    new Promise((resolve, reject) => {
      stream.write(chunk, (error) => (error ? reject(error) : resolve()))
    })

  return {
    async start() {
      await write(
        format === 'json'
          ? '[\n'
          : `${CSV_COLUMNS.map(([name]) => name).join(',')}\n`,
      )
    },
    async add(trace) {
      if (format === 'json') {
        await write(
          `${count > 0 ? ',\n' : ''}${JSON.stringify(trace, null, 2)}`,
        )
      } else {
        await write(
          `${CSV_COLUMNS.map(([, get]) => toCsvCell(get(trace))).join(',')}\n`,
        )
      }
      count++
    },
    async end() {
      if (format === 'json') {
        await write('\n]\n')
      }
      await new Promise((resolve, reject) => {
        stream.end((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

function buildOutputPath(options) {
  const runAt = new Date().toISOString().replace(/[:.]/g, '-')
  const scope = options.traceId
    ? `trace-${options.traceId}`
    : `${formatDate(options.range.from)}_to_${formatDate(new Date(options.range.to.getTime() - 1))}`
  return join(
    OUT_DIR,
    `traces_${options.project}_${options.environment}_${scope}_${runAt}.${options.format}`,
  )
}

async function main() {
  const options = await resolveOptions(process.argv.slice(2))
  const client = buildLangfuseClient(options.project, process.env, {
    timeout: 60000,
  })

  console.log(
    `\nExporting ${options.project} traces (${options.environment}) as ${options.format}`,
  )
  if (options.traceId) {
    console.log(`Trace: ${options.traceId}`)
  } else {
    console.log(
      `Range: ${options.range.from.toISOString()} → ${options.range.to.toISOString()}`,
    )
  }
  if (options.userId) {
    console.log(`User: ${options.userId}`)
  }

  const ids = options.traceId
    ? [options.traceId]
    : await listTraceIds(client, options)

  if (ids.length === 0) {
    console.log('No traces found. Nothing written.')
    return
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = buildOutputPath(options)
  const writer = createWriter(outPath, options.format)
  const progress = createProgress('Downloading traces')
  const failures = []
  let done = 0

  await writer.start()
  progress.update(0, ids.length)
  await fetchInOrder(
    ids,
    options.concurrency,
    async (id) => {
      try {
        return await client.api.trace.get(id, REQUEST_OPTIONS)
      } catch (error) {
        failures.push({
          id,
          message: (error?.message ?? String(error)).split('\n')[0],
        })
        return null
      } finally {
        progress.update(++done, ids.length)
      }
    },
    async (trace) => {
      if (trace) {
        await writer.add(trace)
      }
    },
  )
  await writer.end()
  progress.finish()

  console.log(`Saved ${ids.length - failures.length} traces to ${outPath}`)

  if (failures.length > 0) {
    console.error(`\n${failures.length} traces failed to download:`)
    for (const { id, message } of failures) {
      console.error(`  ${id}: ${message}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
