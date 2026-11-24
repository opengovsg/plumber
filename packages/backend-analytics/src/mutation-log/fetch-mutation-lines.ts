import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  type ResultField,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'

import {
  type MutationLogLine,
  parseInsightsTimestamp,
} from './parse-mutation-line'

// Logs Insights returns at most this many rows per query.
export const MAX_QUERY_RESULTS = 10_000

const POLL_INTERVAL_MS = 1_000
const QUERY_TIMEOUT_MS = 15 * 60 * 1_000
// The SDK sets no request timeout by default, so one stalled call would hang the archival task.
const REQUEST_TIMEOUT_MS = 60_000

export function createLogsClient(region: string): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region,
    requestHandler: {
      connectionTimeout: 10_000,
      requestTimeout: REQUEST_TIMEOUT_MS,
    },
  })
}

// IMPORTANT: the request log nests its fields under `message`. Winston wraps a
// lone object that has no `message` key.
export const MUTATION_LOG_QUERY = [
  'fields @timestamp, `message.graphql-query` as query, `message.graphql-variables` as variables, `message.user-id` as userId, `message.status` as status',
  '| filter `message.graphql-query` like /^\\s*mutation/',
  '| sort @timestamp asc',
  `| limit ${MAX_QUERY_RESULTS}`,
].join('\n')

type LogsClient = Pick<CloudWatchLogsClient, 'send'>

interface FetchMutationLinesParams {
  client: LogsClient
  logGroup: string
  startMs: number
  endMs: number
  // Cancels every request and poll, so a caller's deadline holds even while a request is in flight.
  signal?: AbortSignal
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

function toLine(fields: ResultField[]): MutationLogLine {
  const value = (name: string) =>
    fields.find((field) => field.field === name)?.value ?? null
  return {
    timestamp: value('@timestamp') ?? '',
    query: value('query'),
    variables: value('variables'),
    userId: value('userId'),
    status: value('status'),
  }
}

async function runQuery({
  client,
  logGroup,
  startMs,
  endMs,
  signal,
  sleep = defaultSleep,
}: FetchMutationLinesParams): Promise<{
  rows: ResultField[][]
  truncated: boolean
}> {
  signal?.throwIfAborted()
  const { queryId } = await client.send(
    new StartQueryCommand({
      logGroupName: logGroup,
      // Whole seconds, inclusive at both ends. Rows outside the window are dropped later.
      startTime: Math.floor(startMs / 1_000),
      endTime: Math.ceil(endMs / 1_000),
      queryString: MUTATION_LOG_QUERY,
      limit: MAX_QUERY_RESULTS,
    }),
    { abortSignal: signal },
  )
  if (!queryId) {
    throw new Error('Logs Insights returned no query id')
  }

  const deadline = Date.now() + QUERY_TIMEOUT_MS
  for (;;) {
    const result = await client.send(new GetQueryResultsCommand({ queryId }), {
      abortSignal: signal,
    })
    if (result.status === 'Complete') {
      const rows = result.results ?? []
      return { rows, truncated: rows.length >= MAX_QUERY_RESULTS }
    }
    if (result.status !== 'Running' && result.status !== 'Scheduled') {
      throw new Error(`Logs Insights query ended as ${result.status}`)
    }
    if (Date.now() > deadline) {
      throw new Error('Logs Insights query timed out')
    }
    await sleep(POLL_INTERVAL_MS, signal)
  }
}

/**
 * Fetches every mutation line with a timestamp in [startMs, endMs).
 *
 * A window that hits the result cap is split in half, on whole seconds.
 */
export async function fetchMutationLines(
  params: FetchMutationLinesParams,
): Promise<MutationLogLine[]> {
  const { startMs, endMs } = params
  const { rows, truncated } = await runQuery(params)

  if (truncated) {
    const mid = Math.floor((startMs + (endMs - startMs) / 2) / 1_000) * 1_000
    if (mid <= startMs || mid >= endMs) {
      throw new Error(
        `More than ${MAX_QUERY_RESULTS} mutations in one second at ${new Date(startMs).toISOString()}`,
      )
    }
    const first = await fetchMutationLines({ ...params, endMs: mid })
    const second = await fetchMutationLines({ ...params, startMs: mid })
    return [...first, ...second]
  }

  return rows.map(toLine).filter((line) => {
    const ms = parseInsightsTimestamp(line.timestamp)?.getTime()
    return ms !== undefined && ms >= startMs && ms < endMs
  })
}
