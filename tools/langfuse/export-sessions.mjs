import { createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { emitKeypressEvents } from 'node:readline'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

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
const EXTRA_FIELDS = [
  'metrics',
  'counts',
  'metadata',
  'fullOutput',
  'observations',
  'scores',
]
// These need one extra request per session. Everything else comes from the last-trace lookup.
const SLOW_FIELDS = ['observations', 'scores']
const DETAIL_LEVELS = [
  { key: 'none', label: 'Core fields only (fast)' },
  { key: 'metadata', label: 'Core fields + metadata (fast)' },
  {
    key: 'metrics,counts',
    label:
      'Core fields + latency, cost and counts (slower, Langfuse computes them per trace)',
  },
  {
    key: 'all',
    label:
      'Everything, with full LLM output, observations and scores (slow, one extra request per session)',
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

  const hasRangeFlag = flags.range || flags.from || flags.to || flags.sessionId
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
    sessionId:
      typeof flags.sessionId === 'string' ? flags.sessionId : undefined,
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

const INITIAL_WINDOW_MS = 3_600_000
const MIN_WINDOW_MS = 60_000
const MIN_PAGE_SIZE = 10
// Rome times out on large queries, so keep windows small.
const TARGET_SESSIONS_PER_WINDOW = 100
const OUTAGE_RETRY_DELAYS_MS = [10_000, 30_000, 60_000]
// Langfuse launched in 2023, so "All time" starts here.
const ALL_TIME_START = new Date('2023-01-01T00:00:00Z')

// Langfuse answers 422 when its query times out. The SDK does not retry 422.
const isQueryTimeout = (error) => error?.statusCode === 422

// The SDK retries these within seconds, which is too short for a database restart.
function isOutage(error) {
  const status = error?.statusCode
  if (status === undefined) {
    return /timeout|fetch failed|ECONN|EHOST|ENOTFOUND|socket/i.test(
      String(error?.message),
    )
  }
  return status >= 500 || status === 408 || status === 429
}

function describeError(error) {
  const status = error?.statusCode
  const detail = error?.body?.error ?? error?.body?.message
  if (status !== undefined) {
    return `HTTP ${status}${detail ? `: ${detail}` : ''}`
  }
  return String(error?.message ?? error).split('\n')[0]
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

function printStatus(line, { keep = false } = {}) {
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}\x1b[K${keep ? '\n' : ''}`)
  } else {
    console.log(line)
  }
}

/**
 * Lists sessions newest first, window by window, calling `onItem` in that order.
 *
 * Langfuse times out on large queries, so each window is sized from the previous window's session count.
 * Walking backward meets the dense recent sessions first, before sparse history grows the window.
 */
async function listSessions(client, options, onItem) {
  const seen = new Set()
  let mismatchedEnvironment = 0
  let missingEnvironment = 0

  const rangeStart = options.range.from ?? ALL_TIME_START
  const rangeEnd = options.range.to
  const rangeMs = Math.max(rangeEnd - rangeStart, 1)

  const fetchPage = (from, to, page, limit) =>
    client.api.sessions.list(
      {
        page,
        limit,
        fromTimestamp: from.toISOString(),
        toTimestamp: to.toISOString(),
        environment: options.environment,
      },
      REQUEST_OPTIONS,
    )

  const processPage = (response) => {
    const result = { items: [], mismatched: 0, missing: 0 }
    for (const session of response.data) {
      // Older Langfuse servers ignore the environment filter, so verify each session.
      if (session.environment === undefined) {
        result.missing++
      } else if (session.environment !== options.environment) {
        result.mismatched++
        continue
      }
      result.items.push(session)
    }
    return result
  }

  async function fetchWindow(from, to, limit) {
    const first = await fetchPage(from, to, 1, limit)
    const pages = [processPage(first)]
    const remainingPages = Array.from(
      { length: Math.max(first.meta.totalPages - 1, 0) },
      (_, i) => i + 2,
    )
    let failed = false
    await fetchInOrder(
      remainingPages,
      options.concurrency,
      async (page) => {
        if (failed) {
          return null
        }
        try {
          return processPage(await fetchPage(from, to, page, limit))
        } catch (error) {
          failed = true
          throw error
        }
      },
      (result) => {
        pages.push(result)
      },
    )
    return { pages, totalItems: first.meta.totalItems }
  }

  let cursor = rangeEnd
  let windowMs = Math.min(INITIAL_WINDOW_MS, rangeMs)
  let limit = PAGE_SIZE
  let targetSessions = TARGET_SESSIONS_PER_WINDOW
  let outageRetries = 0

  while (cursor > rangeStart) {
    const windowStart = new Date(
      Math.max(cursor.getTime() - windowMs, rangeStart.getTime()),
    )
    const pct = Math.floor(((rangeEnd - cursor) / rangeMs) * 100)
    printStatus(
      `Listing sessions: back to ${cursor.toISOString()} (${pct}%) · ${seen.size} found · window ${formatDuration(windowMs)}`,
    )

    let result
    try {
      result = await fetchWindow(windowStart, cursor, limit)
    } catch (error) {
      if (isOutage(error) && outageRetries < OUTAGE_RETRY_DELAYS_MS.length) {
        const delayMs = OUTAGE_RETRY_DELAYS_MS[outageRetries++]
        printStatus(
          `Langfuse failed (${describeError(error)}). Waiting ${delayMs / 1000}s before retry ${outageRetries}/${OUTAGE_RETRY_DELAYS_MS.length}.`,
          { keep: true },
        )
        await sleep(delayMs)
        continue
      }
      if (!isQueryTimeout(error)) {
        error.listedBackTo = cursor
        throw error
      }
      // Each timeout costs a full server timeout, so shrink aggressively and remember the lower ceiling.
      targetSessions = Math.max(MIN_PAGE_SIZE, Math.floor(targetSessions / 2))
      if (windowMs > MIN_WINDOW_MS) {
        windowMs = Math.max(MIN_WINDOW_MS, Math.floor(windowMs / 4))
        printStatus(
          `Langfuse timed out. Retrying with a ${formatDuration(windowMs)} window.`,
          { keep: true },
        )
        continue
      }
      if (limit > MIN_PAGE_SIZE) {
        limit = Math.max(MIN_PAGE_SIZE, Math.floor(limit / 2))
        printStatus(
          `Langfuse timed out. Retrying with ${limit} sessions per page.`,
          { keep: true },
        )
        continue
      }
      throw Object.assign(
        new Error(
          `Langfuse timed out on a ${formatDuration(windowMs)} window ending ${cursor.toISOString()} with ${limit} sessions per page.`,
        ),
        { listedBackTo: cursor },
      )
    }

    // The sessions endpoint has no sort option, so order each window here.
    const windowSessions = []
    for (const page of result.pages) {
      mismatchedEnvironment += page.mismatched
      missingEnvironment += page.missing
      windowSessions.push(...page.items)
    }
    windowSessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    for (const session of windowSessions) {
      // Adjacent windows can share a boundary session.
      if (!seen.has(session.id)) {
        seen.add(session.id)
        await onItem(session)
      }
    }

    cursor = windowStart
    outageRetries = 0
    const idealMs =
      result.totalItems === 0
        ? windowMs * 2
        : (windowMs * targetSessions) / result.totalItems
    windowMs = Math.round(
      Math.min(
        Math.max(idealMs, windowMs / 4, MIN_WINDOW_MS),
        windowMs * 2,
        rangeMs,
      ),
    )
  }
  printStatus(`Listing sessions: done (100%) · ${seen.size} found`, {
    keep: true,
  })

  if (mismatchedEnvironment > 0) {
    console.warn(
      `Skipped ${mismatchedEnvironment} sessions from other environments. The server ignored the environment filter.`,
    )
  }
  if (missingEnvironment > 0) {
    console.warn(
      `WARNING: ${missingEnvironment} sessions have no environment field. They may come from any environment.`,
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
// `context` holds the session and its trace count.
const CORE_FIELDS = [
  ['sessionId', (t, c) => c.session.id],
  ['sessionCreatedAt', (t, c) => c.session.createdAt],
  ['traceCount', (t, c) => c.traceCount],
  ['lastTraceId', (t) => t.id],
  ['lastTraceTimestamp', (t) => t.timestamp],
  ['name', (t) => t.name],
  ['environment', (t) => t.environment],
  ['userId', (t) => t.userId],
  ['tags', (t) => t.tags],
  ['input', (t) => t.input],
  ['output', (t) => slimOutput(t.output)],
  ['url', (t, c) => (t.htmlPath ? `${c.baseUrl}${t.htmlPath}` : undefined)],
]

/**
 * Keeps the reply text from an AI SDK result.
 *
 * `request` and `steps` repeat the system prompt and tool definitions, which make up most of the export size.
 */
function slimOutput(output) {
  const isAiSdkResult =
    output !== null &&
    typeof output === 'object' &&
    ('request' in output || 'steps' in output)
  if (!isAiSdkResult) {
    return output
  }
  return {
    text: output.text,
    object: output.object,
    finishReason: output.finishReason,
    model: output.response?.modelId,
    usage: output.totalUsage ?? output.usage,
  }
}

// Opt-in because Langfuse computes these per trace, which slows each lookup.
const OPTIONAL_FIELDS = {
  metrics: [
    ['latencySeconds', (t) => t.latency],
    ['totalCostUsd', (t) => t.totalCost],
  ],
  counts: [
    ['observationCount', (t) => t.observations?.length ?? 0],
    ['scoreCount', (t) => t.scores?.length ?? 0],
  ],
}

// Tells Langfuse which field groups to compute for the last-trace lookup.
function buildListFields(include, needsFullTrace) {
  if (needsFullTrace) {
    return 'core'
  }
  return [
    'core',
    'io',
    ...(include.includes('metrics') ? ['metrics'] : []),
    ...(include.includes('counts') ? ['observations', 'scores'] : []),
  ].join(',')
}

function buildFields(include) {
  const fields = include.includes('fullOutput')
    ? CORE_FIELDS.map((field) =>
        field[0] === 'output' ? ['output', (t) => t.output] : field,
      )
    : CORE_FIELDS
  return [
    ...fields,
    ...include.flatMap((field) => OPTIONAL_FIELDS[field] ?? []),
    ...include
      .filter((field) => ['metadata', 'observations', 'scores'].includes(field))
      .map((field) => [field, (t) => t[field]]),
  ]
}

function toRecord(trace, fields, context) {
  return Object.fromEntries(
    fields.map(([name, get]) => [name, get(trace, context) ?? null]),
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
  const scope = options.sessionId
    ? `session-${options.sessionId}`
    : `${options.range.from ? formatDate(options.range.from) : 'all-time'}_to_${formatDate(new Date(options.range.to.getTime() - 1))}`
  return join(
    OUT_DIR,
    `sessions_${options.project}_${options.environment}_${scope}_${runAt}.${options.format}`,
  )
}

/**
 * Fetches each session's last trace, which holds the input and output of the whole conversation.
 *
 * Calls `onRecord` in session order. Sessions with no matching trace are counted in `skipped`.
 */
async function fetchLastTraces(client, sessions, options, onRecord) {
  const listFields = buildListFields(options.include, options.needsFullTrace)
  const progress = createProgress('Downloading last traces')
  const failures = []
  let skipped = 0
  let done = 0

  progress.update(0, sessions.length)
  await fetchInOrder(
    sessions,
    options.concurrency,
    async (session) => {
      try {
        const response = await client.api.trace.list(
          {
            page: 1,
            limit: 1,
            orderBy: 'timestamp.desc',
            sessionId: session.id,
            environment: options.environment,
            fields: listFields,
          },
          REQUEST_OPTIONS,
        )
        const [last] = response.data
        if (!last) {
          return null
        }
        const trace = options.needsFullTrace
          ? await client.api.trace.get(last.id, REQUEST_OPTIONS)
          : last
        return { session, trace, traceCount: response.meta.totalItems }
      } catch (error) {
        failures.push({ id: session.id, message: describeError(error) })
        return null
      } finally {
        progress.update(++done, sessions.length)
      }
    },
    async (result) => {
      if (!result) {
        return
      }
      if (options.userId && result.trace.userId !== options.userId) {
        return
      }
      if (
        result.trace.environment !== undefined &&
        result.trace.environment !== options.environment
      ) {
        skipped++
        return
      }
      await onRecord(result)
    },
  )
  progress.finish()
  return { failures, skipped }
}

async function main() {
  const options = await resolveOptions(process.argv.slice(2))
  const client = buildLangfuseClient(options.project, process.env, {
    timeout: 60000,
  })
  const baseUrl = (process.env.PAIR_ROME_BASE_URL ?? '').replace(/\/+$/, '')
  const fields = buildFields(options.include)
  options.needsFullTrace = options.include.some((field) =>
    SLOW_FIELDS.includes(field),
  )

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

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = buildOutputPath(options)
  const writer = createWriter(
    outPath,
    options.format,
    fields.map(([name]) => name),
  )
  const sessions = []
  let listingError

  // A listing failure keeps what was already listed, so a long export is not lost.
  const list = async () => {
    try {
      await listSessions(client, options, (session) => sessions.push(session))
    } catch (error) {
      if (error?.listedBackTo === undefined) {
        throw error
      }
      if (process.stdout.isTTY) {
        process.stdout.write('\n')
      }
      listingError = error
    }
  }

  await writer.start()
  if (options.sessionId) {
    sessions.push({ id: options.sessionId, createdAt: null })
  } else {
    await list()
  }
  const { failures, skipped } = await fetchLastTraces(
    client,
    sessions,
    options,
    ({ session, trace, traceCount }) =>
      writer.add(toRecord(trace, fields, { baseUrl, session, traceCount })),
  )
  const saved = await writer.end()

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

main().catch((error) => {
  console.error(`\n${describeError(error)}`)
  process.exit(1)
})
