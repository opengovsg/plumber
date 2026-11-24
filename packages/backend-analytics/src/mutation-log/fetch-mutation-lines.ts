import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  type ResultField,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs'

import { MCP_EDIT_TOOLS, type McpToolLine } from './parse-mcp-tool-line'
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

// The AI builder's tool calls run inside the chat stream, so Morgan never logs them.
export const MCP_TOOL_LOG_QUERY = [
  'fields @timestamp, @message',
  "| filter `message.event` = 'mcp-tool' and `message.source` = 'plumber'",
  `| filter \`message.tool\` in [${MCP_EDIT_TOOLS.map((tool) => `'${tool}'`).join(', ')}]`,
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

function fieldValue(fields: ResultField[], name: string): string | null {
  return fields.find((field) => field.field === name)?.value ?? null
}

function toLine(fields: ResultField[]): MutationLogLine {
  const value = (name: string) => fieldValue(fields, name)
  return {
    timestamp: value('@timestamp') ?? '',
    query: value('query'),
    variables: value('variables'),
    userId: value('userId'),
    status: value('status'),
  }
}

async function runQuery(
  queryString: string,
  {
    client,
    logGroup,
    startMs,
    endMs,
    signal,
    sleep = defaultSleep,
  }: FetchMutationLinesParams,
): Promise<{
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
      queryString,
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

async function fetchRows(
  queryString: string,
  params: FetchMutationLinesParams,
): Promise<ResultField[][]> {
  const { startMs, endMs } = params
  const { rows, truncated } = await runQuery(queryString, params)
  if (!truncated) {
    // Each window keeps only its own rows, so a line on a split boundary is not read twice.
    return rows.filter((fields) =>
      inWindow(params)({ timestamp: fieldValue(fields, '@timestamp') ?? '' }),
    )
  }
  const mid = Math.floor((startMs + (endMs - startMs) / 2) / 1_000) * 1_000
  if (mid <= startMs || mid >= endMs) {
    throw new Error(
      `More than ${MAX_QUERY_RESULTS} log lines in one second at ${new Date(startMs).toISOString()}`,
    )
  }
  const first = await fetchRows(queryString, { ...params, endMs: mid })
  const second = await fetchRows(queryString, { ...params, startMs: mid })
  return [...first, ...second]
}

function inWindow(
  params: FetchMutationLinesParams,
): (line: { timestamp: string }) => boolean {
  return (line) => {
    const ms = parseInsightsTimestamp(line.timestamp)?.getTime()
    return ms !== undefined && ms >= params.startMs && ms < params.endMs
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
  const rows = await fetchRows(MUTATION_LOG_QUERY, params)
  return rows.map(toLine)
}

/**
 * Fetches every AI builder edit with a timestamp in [startMs, endMs).
 */
export async function fetchMcpToolLines(
  params: FetchMutationLinesParams,
): Promise<McpToolLine[]> {
  const rows = await fetchRows(MCP_TOOL_LOG_QUERY, params)
  return rows.map((fields) => ({
    timestamp: fieldValue(fields, '@timestamp') ?? '',
    event: fieldValue(fields, '@message'),
  }))
}
