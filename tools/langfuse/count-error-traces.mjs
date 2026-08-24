/**
 * Count AI Builder traces in Langfuse (Rome).
 *
 * Prints historical ERROR counts and the recent window, which should now be 0.
 *
 *   node tools/langfuse/count-error-traces.mjs
 *   node tools/langfuse/count-error-traces.mjs --since=2026-03-01 --recent-hours=24 --list
 *   node tools/langfuse/count-error-traces.mjs --name=ai-chat-stream --assert-recent-zero
 *
 * Reads PAIR_ROME_* from packages/backend/.env (override with --env=).
 *
 * --since=YYYY-MM-DD     start of window (default: 90 days ago)
 * --until=YYYY-MM-DD     end of window (default: now)
 * --recent-hours=N       "now" window (default: 24)
 * --name=<trace name>    only this name (e.g. ai-chat-stream)
 * --project=aiBuilder    aiBuilder | pairAction
 * --env=<path>           env file
 * --list                 print ERROR traces in the recent window
 * --assert-recent-zero   exit 1 if the recent window has ERROR traces
 * --json                 JSON output
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SINCE_DAYS = 90
const DEFAULT_RECENT_HOURS = 24
const PAGE_SIZE = 100
const PAGE_CAP = 100

function parseArgs(argv) {
  const flags = {}
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`)
    }
    flags[match[1]] = match[2] === undefined ? true : match[2]
  }

  const since = flags.since
    ? parseDay(flags.since, 'start')
    : daysAgo(DEFAULT_SINCE_DAYS)
  const until = flags.until ? parseDay(flags.until, 'end') : new Date()
  const recentHours = flags['recent-hours']
    ? Number(flags['recent-hours'])
    : DEFAULT_RECENT_HOURS

  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    throw new Error('--since and --until must be valid dates (YYYY-MM-DD)')
  }
  if (!Number.isFinite(recentHours) || recentHours <= 0) {
    throw new Error('--recent-hours must be a positive number')
  }
  if (since >= until) {
    throw new Error('--since must be before --until')
  }

  return {
    since,
    until,
    recentHours,
    recentFrom: new Date(until.getTime() - recentHours * 60 * 60 * 1000),
    name: typeof flags.name === 'string' ? flags.name : undefined,
    project: flags.project ?? 'aiBuilder',
    envPath: resolve(
      flags.env ?? join(__dirname, '../../packages/backend/.env'),
    ),
    list: Boolean(flags.list),
    assertRecentZero: Boolean(flags['assert-recent-zero']),
    json: Boolean(flags.json),
  }
}

function parseDay(value, edge) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (edge === 'end') {
    date.setUTCHours(23, 59, 59, 999)
  }
  return date
}

function daysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function toIso(date) {
  return date.toISOString()
}

function toYmd(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

function loadEnv(envPath) {
  let raw
  try {
    raw = readFileSync(envPath, 'utf8')
  } catch {
    throw new Error(`Could not load env file at ${envPath}`)
  }

  const parsed = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (!match) {
      continue
    }
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[match[1]] = value
  }
  return parsed
}

function createClient(project, env) {
  const credentials =
    project === 'aiBuilder'
      ? {
          publicKey: env.PAIR_ROME_AI_BUILDER_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_AI_BUILDER_SECRET_KEY,
        }
      : {
          publicKey: env.PAIR_ROME_PAIR_ACTION_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_PAIR_ACTION_SECRET_KEY,
        }

  if (
    !credentials.publicKey ||
    !credentials.secretKey ||
    !env.PAIR_ROME_BASE_URL
  ) {
    throw new Error(
      `Missing PAIR_ROME credentials for project "${project}" in the env file`,
    )
  }

  const headers = {
    Authorization: `Basic ${Buffer.from(
      `${credentials.publicKey}:${credentials.secretKey}`,
    ).toString('base64')}`,
    'Content-Type': 'application/json',
  }

  if (
    env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY &&
    env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY
  ) {
    headers['CF-Access-Client-Id'] =
      env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY
    headers['CF-Access-Client-Secret'] =
      env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY
  }

  return {
    baseUrl: env.PAIR_ROME_BASE_URL.replace(/\/$/, ''),
    headers,
  }
}

async function langfuseGet(client, path, query = {}) {
  const url = new URL(path.replace(/^\//, ''), `${client.baseUrl}/`)
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, { headers: client.headers })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!response.ok) {
    const detail =
      typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body)
    throw new Error(
      `Langfuse ${path} failed (${response.status}): ${detail || response.statusText}`,
    )
  }

  return body
}

function metricsFilters({ name, errorsOnly }) {
  const filters = []
  if (name) {
    filters.push({
      column: 'name',
      operator: '=',
      value: name,
      type: 'string',
    })
  }
  if (errorsOnly) {
    filters.push({
      column: 'level',
      operator: '=',
      value: 'ERROR',
      type: 'string',
    })
  }
  return filters
}

function tracesFilters({ name, errorsOnly }) {
  const filters = []
  if (name) {
    filters.push({
      type: 'stringOptions',
      column: 'name',
      operator: 'any of',
      value: [name],
    })
  }
  if (errorsOnly) {
    filters.push({
      type: 'stringOptions',
      column: 'level',
      operator: 'any of',
      value: ['ERROR'],
    })
  }
  return filters
}

function pickCount(row) {
  for (const key of ['count_count', 'count', 'value']) {
    if (row[key] != null) {
      return Number(row[key])
    }
  }
  const numeric = Object.values(row).find(
    (value) => typeof value === 'number' && Number.isFinite(value),
  )
  return Number(numeric ?? 0)
}

function parseMetricsRows(body) {
  const data = body?.data
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }
  if (Array.isArray(data[0])) {
    const [header, ...rows] = data
    return rows.map((row) =>
      Object.fromEntries(header.map((key, index) => [key, row[index]])),
    )
  }
  return data
}

async function queryMetricsDaily(client, { from, to, name, errorsOnly }) {
  const query = {
    view: 'traces',
    metrics: [{ measure: 'count', aggregation: 'count' }],
    dimensions: [],
    filters: metricsFilters({ name, errorsOnly }),
    timeDimension: { granularity: 'day' },
    fromTimestamp: toIso(from),
    toTimestamp: toIso(to),
  }

  let body
  try {
    body = await langfuseGet(client, '/api/public/metrics', {
      query: JSON.stringify(query),
    })
  } catch (error) {
    const v2Query = {
      view: 'observations',
      metrics: [{ measure: 'count', aggregation: 'count' }],
      filters: [
        ...metricsFilters({ name, errorsOnly }),
        {
          column: 'isRootObservation',
          operator: '=',
          value: true,
          type: 'boolean',
        },
      ],
      timeDimension: { granularity: 'day' },
      fromTimestamp: toIso(from),
      toTimestamp: toIso(to),
    }
    try {
      body = await langfuseGet(client, '/api/public/v2/metrics', {
        query: JSON.stringify(v2Query),
      })
    } catch {
      throw error
    }
  }

  const byDay = new Map()
  for (const row of parseMetricsRows(body)) {
    const day = toYmd(
      row.time_dimension ?? row.timeDimension ?? row.date ?? row.timestamp ?? '',
    )
    if (!day) {
      continue
    }
    byDay.set(day, (byDay.get(day) ?? 0) + pickCount(row))
  }
  return byDay
}

function isErrorTrace(trace) {
  return (
    trace.level === 'ERROR' ||
    (typeof trace.errorCount === 'number' && trace.errorCount > 0)
  )
}

async function listTraces(client, { from, to, name, errorsOnly }) {
  const traces = []
  for (let page = 1; page <= PAGE_CAP; page++) {
    const query = {
      page: String(page),
      limit: String(PAGE_SIZE),
      fromTimestamp: toIso(from),
      toTimestamp: toIso(to),
    }
    if (name) {
      query.name = name
    }
    const listFilters = tracesFilters({ name, errorsOnly })
    if (listFilters.length > 0) {
      query.filter = JSON.stringify(listFilters)
    }

    const body = await langfuseGet(client, '/api/public/traces', query)
    const batch = Array.isArray(body?.data) ? body.data : []
    traces.push(...batch)

    const totalPages = body?.meta?.totalPages
    if (batch.length < PAGE_SIZE) {
      break
    }
    if (typeof totalPages === 'number' && page >= totalPages) {
      break
    }
    if (page === PAGE_CAP) {
      console.warn(
        `Stopped after ${PAGE_CAP * PAGE_SIZE} traces (page cap). Counts may be incomplete.`,
      )
    }
  }
  return traces
}

function bucketTracesByDay(traces) {
  const total = new Map()
  const errors = new Map()
  for (const trace of traces) {
    const day = toYmd(trace.timestamp ?? trace.createdAt ?? '')
    if (!day) {
      continue
    }
    total.set(day, (total.get(day) ?? 0) + 1)
    if (isErrorTrace(trace)) {
      errors.set(day, (errors.get(day) ?? 0) + 1)
    }
  }
  return { total, errors }
}

function eachDay(from, to) {
  const days = []
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  )
  const last = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  )
  while (cursor <= last) {
    days.push(toYmd(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function sumMap(map, predicate = () => true) {
  let total = 0
  for (const [day, count] of map) {
    if (predicate(day)) {
      total += count
    }
  }
  return total
}

function pad(value, width) {
  return String(value).padStart(width)
}

function rate(errors, total) {
  if (total === 0) {
    return 'n/a'
  }
  return `${((errors / total) * 100).toFixed(1)}%`
}

async function collect(client, options) {
  const { since, until, name } = options
  let totalByDay
  let errorByDay

  try {
    ;[totalByDay, errorByDay] = await Promise.all([
      queryMetricsDaily(client, {
        from: since,
        to: until,
        name,
        errorsOnly: false,
      }),
      queryMetricsDaily(client, {
        from: since,
        to: until,
        name,
        errorsOnly: true,
      }),
    ])
  } catch (error) {
    console.warn(
      `Metrics API unavailable (${error instanceof Error ? error.message : error}). Falling back to /api/public/traces.`,
    )
    const traces = await listTraces(client, {
      from: since,
      to: until,
      name,
      errorsOnly: false,
    })
    const bucketed = bucketTracesByDay(traces)
    totalByDay = bucketed.total
    errorByDay = bucketed.errors
  }

  const daily = eachDay(since, until).map((day) => ({
    day,
    total: totalByDay.get(day) ?? 0,
    errors: errorByDay.get(day) ?? 0,
  }))

  return { daily, totalByDay, errorByDay }
}

async function listErrorTraces(client, { from, to, name }) {
  try {
    return await listTraces(client, { from, to, name, errorsOnly: true })
  } catch {
    const traces = await listTraces(client, {
      from,
      to,
      name,
      errorsOnly: false,
    })
    return traces.filter(isErrorTrace)
  }
}

function printReport(options, collected, recentErrorTraces) {
  const { since, until, recentFrom, recentHours, name, project } = options
  const recentDay = toYmd(recentFrom)
  const { daily, totalByDay, errorByDay } = collected

  const windowTotal = sumMap(totalByDay)
  const windowErrors = sumMap(errorByDay)
  const historicalTotal = sumMap(totalByDay, (day) => day < recentDay)
  const historicalErrors = sumMap(errorByDay, (day) => day < recentDay)
  const recentTotal = sumMap(totalByDay, (day) => day >= recentDay)
  const recentErrors = sumMap(errorByDay, (day) => day >= recentDay)

  console.log(`AI Builder Langfuse traces (${project})`)
  if (name) {
    console.log(`Trace name: ${name}`)
  }
  console.log(`Window:     ${toIso(since)} → ${toIso(until)}`)
  console.log(
    `Recent:     last ${recentHours}h (${toIso(recentFrom)} → ${toIso(until)})`,
  )
  console.log('')
  console.log(
    `${pad('DATE', 12)} ${pad('TOTAL', 8)} ${pad('ERRORS', 8)} ${pad('RATE', 8)}`,
  )
  for (const row of daily) {
    if (row.total === 0 && row.errors === 0) {
      continue
    }
    console.log(
      `${pad(row.day, 12)} ${pad(row.total, 8)} ${pad(row.errors, 8)} ${pad(
        rate(row.errors, row.total),
        8,
      )}`,
    )
  }
  console.log('')
  console.log('Summary')
  console.log(
    `  Full window:  ${pad(windowTotal, 6)} traces, ${pad(windowErrors, 6)} errors (${rate(windowErrors, windowTotal)})`,
  )
  console.log(
    `  Historical:   ${pad(historicalTotal, 6)} traces, ${pad(historicalErrors, 6)} errors (${rate(historicalErrors, historicalTotal)})`,
  )
  console.log(
    `  Last ${String(recentHours).padStart(2)}h:    ${pad(recentTotal, 6)} traces, ${pad(recentErrors, 6)} errors (${rate(recentErrors, recentTotal)})`,
  )
  console.log('')
  if (recentErrors === 0) {
    console.log('Recent window has 0 ERROR traces.')
  } else {
    console.log(`Recent window still has ${recentErrors} ERROR trace(s).`)
  }

  if (recentErrorTraces.length > 0) {
    console.log('')
    console.log('ERROR traces in the recent window:')
    for (const trace of recentErrorTraces) {
      console.log(
        `  ${trace.timestamp ?? '?'}  ${trace.id}  ${trace.name ?? '(unnamed)'}`,
      )
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const env = loadEnv(options.envPath)
  const client = createClient(options.project, env)
  const collected = await collect(client, options)
  const recentDay = toYmd(options.recentFrom)
  const recentErrorCount = sumMap(
    collected.errorByDay,
    (day) => day >= recentDay,
  )

  const shouldFetchRecentErrors =
    options.list || options.json || options.assertRecentZero
  const recentErrorTraces = shouldFetchRecentErrors
    ? await listErrorTraces(client, {
        from: options.recentFrom,
        to: options.until,
        name: options.name,
      })
    : []

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          project: options.project,
          name: options.name ?? null,
          since: toIso(options.since),
          until: toIso(options.until),
          recentFrom: toIso(options.recentFrom),
          daily: collected.daily,
          historicalErrors: sumMap(
            collected.errorByDay,
            (day) => day < recentDay,
          ),
          recentErrors: recentErrorCount,
          recentErrorTraces: recentErrorTraces.map((trace) => ({
            id: trace.id,
            name: trace.name,
            timestamp: trace.timestamp,
            level: trace.level,
          })),
        },
        null,
        2,
      ),
    )
  } else {
    printReport(options, collected, options.list ? recentErrorTraces : [])
  }

  if (options.assertRecentZero && recentErrorCount > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
