import { createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { emitKeypressEvents } from 'node:readline'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

/**
 * Exports Langfuse traces to tools/langfuse/data/.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run export-traces [options]
 *
 * With no range flags in an interactive terminal, it prompts for each unset option.
 *
 * Options:
 *   --project=aiBuilder|pairAction    default aiBuilder
 *   --environment=prod|staging|uat    default prod
 *   --range=1h|1d|7d|30d|90d|all      default 30d
 *   --from=YYYY-MM-DD --to=YYYY-MM-DD custom range, both days inclusive, local time
 *   --format=json|csv                 default json
 *   --userId=<id>                     only traces for this user
 *   --traceId=<id>                    export one trace and ignore the range
 *   --include=<fields>                comma-separated extras: metadata, observations, scores, or all
 *   --concurrency=<n>                 parallel requests, default 5
 *   --yes                             skip prompts and use defaults
 *
 * Examples:
 *   pnpm run export-traces
 *   pnpm run export-traces --range=7d --format=csv
 *   pnpm run export-traces --range=all
 *   pnpm run export-traces --range=7d --include=observations,scores
 *   pnpm run export-traces --from=2026-10-01 --to=2026-10-31 --environment=staging
 */
import { buildLangfuseClient, PROJECTS } from './client.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'data')

const ENVIRONMENTS = ['prod', 'staging', 'uat']
const FORMATS = ['json', 'csv']
const RANGES = [
  { key: '1h', label: 'Last 1 hour', hours: 1 },
  { key: '1d', label: 'Last 1 day', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 7 * 24 },
  { key: '30d', label: 'Last 30 days', hours: 30 * 24 },
  { key: '90d', label: 'Last 90 days', hours: 90 * 24 },
  { key: 'all', label: 'All time', hours: null },
]
const DEFAULT_RANGE = '30d'
const EXTRA_FIELDS = ['metadata', 'observations', 'scores']
// These need one request per trace. Everything else comes from the trace list pages.
const SLOW_FIELDS = ['observations', 'scores']
const DETAIL_LEVELS = [
  { key: 'none', label: 'Core fields only (fast)' },
  { key: 'metadata', label: 'Core fields + metadata (fast)' },
  {
    key: 'all',
    label:
      'Everything, with observations and scores (slow, one request per trace)',
  },
]
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

function rangeFromHours(hours, now = new Date()) {
  if (hours === null) {
    return { from: undefined, to: now }
  }
  return { from: new Date(now.getTime() - hours * 3_600_000), to: now }
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

const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

/**
 * Arrow-key menu. Enter picks the highlighted option, which starts on the default.
 */
function ask(question, options, defaultKey) {
  const { stdin, stdout } = process
  let index = Math.max(
    0,
    options.findIndex((option) => option.key === defaultKey),
  )

  const render = () => {
    for (const [i, option] of options.entries()) {
      const marker = option.key === defaultKey ? ` ${DIM}(default)${RESET}` : ''
      const line =
        i === index
          ? `${CYAN}❯ ${option.label}${RESET}${marker}`
          : `  ${option.label}${marker}`
      stdout.write(`\x1b[2K${line}\n`)
    }
  }

  stdout.write(`\n${question} ${DIM}(↑/↓, Enter)${RESET}\n\x1b[?25l`)
  render()

  emitKeypressEvents(stdin)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.off('keypress', onKeypress)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\x1b[?25h')
    }

    function onKeypress(text, key = {}) {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        process.exit(130)
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        // Collapses the menu into one line that shows the answer.
        stdout.write(
          `\x1b[${options.length + 1}A\x1b[0J${question} ${CYAN}${options[index].label}${RESET}\n`,
        )
        resolve(options[index].key)
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        index = (index - 1 + options.length) % options.length
      } else if (key.name === 'down' || key.name === 'j') {
        index = (index + 1) % options.length
      } else if (/^[1-9]$/.test(text ?? '') && Number(text) <= options.length) {
        index = Number(text) - 1
      } else {
        return
      }
      stdout.write(`\x1b[${options.length}A`)
      render()
    }

    stdin.on('keypress', onKeypress)
  })
}

async function askDate(label, defaultValue) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
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
  } finally {
    rl.close()
  }
}

async function promptForMissing(flags) {
  const answers = { ...flags }
  const toOptions = (values) => values.map((v) => ({ key: v, label: v }))

  answers.project ??= await ask('Project:', toOptions(PROJECTS), 'aiBuilder')
  answers.environment ??= await ask(
    'Environment:',
    toOptions(ENVIRONMENTS),
    'prod',
  )

  const rangeKey = await ask(
    'Date range:',
    [...RANGES, { key: 'custom', label: 'Custom date range' }],
    DEFAULT_RANGE,
  )
  if (rangeKey === 'custom') {
    answers.from = await askDate(
      'Start date',
      formatDate(addDays(new Date(), -30)),
    )
    answers.to = await askDate('End date', formatDate(new Date()))
  } else {
    answers.range = rangeKey
  }

  answers.include ??= await ask('Fields:', DETAIL_LEVELS, 'none')
  answers.format ??= await ask('Format:', toOptions(FORMATS), 'json')
  return answers
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
    range = rangeFromHours(RANGES.find((r) => r.key === key).hours)
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
    include: parseInclude(flags.include),
    concurrency,
    range,
  }
}

function parseInclude(value) {
  if (value === undefined || value === 'none') {
    return []
  }
  if (value === 'all') {
    return EXTRA_FIELDS
  }
  const fields = String(value)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
  for (const field of fields) {
    oneOf('include', field, [...EXTRA_FIELDS, 'all', 'none'])
  }
  return [...new Set(fields)]
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

/**
 * Lists traces with pages fetched in parallel, calling `onTrace` in timestamp order.
 *
 * `fields` asks the server to skip heavy field groups. Older servers ignore it.
 */
async function listTraces(client, options, onTrace, { fields } = {}) {
  const seen = new Set()
  let mismatchedEnvironment = 0
  let missingEnvironment = 0

  const fetchPage = (page) =>
    client.api.trace.list(
      {
        page,
        limit: PAGE_SIZE,
        orderBy: 'timestamp.asc',
        fromTimestamp: options.range.from?.toISOString(),
        toTimestamp: options.range.to.toISOString(),
        environment: options.environment,
        userId: options.userId,
        fields,
      },
      REQUEST_OPTIONS,
    )

  const handlePage = async (response) => {
    for (const trace of response.data) {
      // Older Langfuse servers ignore the environment filter, so verify each trace.
      if (trace.environment === undefined) {
        missingEnvironment++
      } else if (trace.environment !== options.environment) {
        mismatchedEnvironment++
        continue
      }
      // Offset pagination can repeat a trace when new traces arrive mid-export.
      if (!seen.has(trace.id)) {
        seen.add(trace.id)
        await onTrace(trace)
      }
    }
  }

  const firstPage = await fetchPage(1)
  const { totalPages, totalItems } = firstPage.meta
  const progress = createProgress('Listing traces (pages)')
  let pagesDone = 1

  progress.update(pagesDone, Math.max(totalPages, 1))
  await handlePage(firstPage)

  const remainingPages = Array.from(
    { length: Math.max(totalPages - 1, 0) },
    (_, i) => i + 2,
  )
  await fetchInOrder(
    remainingPages,
    options.concurrency,
    async (page) => {
      const response = await fetchPage(page)
      progress.update(++pagesDone, totalPages)
      return response
    },
    handlePage,
  )
  progress.finish()
  console.log(`Found ${seen.size} traces.`)

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

  return seen.size
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

// Works for list items (observation and score ids) and full traces (objects).
const CORE_FIELDS = [
  ['id', (t) => t.id],
  ['timestamp', (t) => t.timestamp],
  ['name', (t) => t.name],
  ['environment', (t) => t.environment],
  ['userId', (t) => t.userId],
  ['sessionId', (t) => t.sessionId],
  ['tags', (t) => t.tags],
  ['input', (t) => t.input],
  ['output', (t) => t.output],
  ['latencySeconds', (t) => t.latency],
  ['totalCostUsd', (t) => t.totalCost],
  ['observationCount', (t) => t.observations?.length ?? 0],
  ['scoreCount', (t) => t.scores?.length ?? 0],
  ['url', (t, baseUrl) => (t.htmlPath ? `${baseUrl}${t.htmlPath}` : undefined)],
]

function buildFields(include) {
  return [...CORE_FIELDS, ...include.map((field) => [field, (t) => t[field]])]
}

function toRecord(trace, fields, baseUrl) {
  return Object.fromEntries(
    fields.map(([name, get]) => [name, get(trace, baseUrl) ?? null]),
  )
}

function toCsvCell(value) {
  if (value === undefined || value === null) {
    return ''
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function createWriter(path, format, columns) {
  const stream = createWriteStream(path, 'utf-8')
  let count = 0

  const write = (chunk) =>
    new Promise((resolve, reject) => {
      stream.write(chunk, (error) => (error ? reject(error) : resolve()))
    })

  return {
    async start() {
      await write(format === 'json' ? '[\n' : `${columns.join(',')}\n`)
    },
    async add(record) {
      if (format === 'json') {
        await write(
          `${count > 0 ? ',\n' : ''}${JSON.stringify(record, null, 2)}`,
        )
      } else {
        await write(
          `${columns.map((column) => toCsvCell(record[column])).join(',')}\n`,
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
      return count
    },
  }
}

function buildOutputPath(options) {
  const runAt = new Date().toISOString().replace(/[:.]/g, '-')
  const scope = options.traceId
    ? `trace-${options.traceId}`
    : `${options.range.from ? formatDate(options.range.from) : 'all-time'}_to_${formatDate(new Date(options.range.to.getTime() - 1))}`
  return join(
    OUT_DIR,
    `traces_${options.project}_${options.environment}_${scope}_${runAt}.${options.format}`,
  )
}

async function fetchFullTraces(client, ids, options, onTrace) {
  const progress = createProgress('Downloading observations and scores')
  const failures = []
  let done = 0

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
        await onTrace(trace)
      }
    },
  )
  progress.finish()
  return failures
}

async function main() {
  const options = await resolveOptions(process.argv.slice(2))
  const client = buildLangfuseClient(options.project, process.env, {
    timeout: 60000,
  })
  const baseUrl = (process.env.PAIR_ROME_BASE_URL ?? '').replace(/\/+$/, '')
  const fields = buildFields(options.include)
  const needsFullTrace = options.include.some((field) =>
    SLOW_FIELDS.includes(field),
  )

  console.log(
    `\nExporting ${options.project} traces (${options.environment}) as ${options.format}`,
  )
  if (options.traceId) {
    console.log(`Trace: ${options.traceId}`)
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

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = buildOutputPath(options)
  const writer = createWriter(
    outPath,
    options.format,
    fields.map(([name]) => name),
  )
  const write = (trace) => writer.add(toRecord(trace, fields, baseUrl))
  let failures = []

  await writer.start()
  if (options.traceId) {
    failures = await fetchFullTraces(client, [options.traceId], options, write)
  } else if (needsFullTrace) {
    const ids = []
    await listTraces(client, options, (trace) => ids.push(trace.id), {
      fields: 'core',
    })
    failures = await fetchFullTraces(client, ids, options, write)
  } else {
    await listTraces(client, options, write)
  }
  const saved = await writer.end()

  if (saved === 0 && failures.length === 0) {
    rmSync(outPath)
    console.log('No traces found. Nothing written.')
    return
  }
  console.log(`Saved ${saved} traces to ${outPath}`)

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
