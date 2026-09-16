import logger from '@/helpers/logger'

export type McpToolSource = 'plumber' | 'gitbook'

type McpToolUsageMeta = {
  source: McpToolSource
  traceId: string
  userId?: string
}

const SAFE_ARG_KEYS = new Set([
  'pipe_id',
  'step_id',
  'connection_id',
  'table_id',
  'form_url',
  'name',
  'app_key',
  'action_key',
  'trigger_key',
  'previous_step_id',
  'columns',
])

const REDACT_ARG_KEYS = new Set(['parameters', 'parameter_labels'])

function redactValuesKeepKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return '[redacted]'
  }

  if (Array.isArray(value)) {
    return value.map(redactValuesKeepKeys)
  }

  const redacted: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    redacted[key] = redactValuesKeepKeys(nested)
  }
  return redacted
}

/**
 * Keeps parameter keys. Drops values that SECRET_KEY_REGEXP would miss.
 */
function summariseMcpToolArgs(args: unknown): unknown {
  if (args === null || typeof args !== 'object') {
    return args
  }

  if (Array.isArray(args)) {
    return args.map(summariseMcpToolArgs)
  }

  const summarised: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (REDACT_ARG_KEYS.has(key)) {
      summarised[key] = redactValuesKeepKeys(value)
      continue
    }
    if (key === 'steps' && Array.isArray(value)) {
      summarised[key] = value.map(summariseMcpToolArgs)
      continue
    }
    if (SAFE_ARG_KEYS.has(key)) {
      summarised[key] = value
      continue
    }
    summarised[key] = '[redacted]'
  }
  return summarised
}

function hasExecute(
  toolDef: unknown,
): toolDef is { execute: (...args: never[]) => unknown } {
  return (
    typeof toolDef === 'object' &&
    toolDef !== null &&
    typeof (toolDef as { execute?: unknown }).execute === 'function'
  )
}

function isErrorResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  )
}

function logUsage({
  tool,
  args,
  status,
  startedAt,
  meta,
}: {
  tool: string
  args: unknown
  status: 'success' | 'error'
  startedAt: number
  meta: McpToolUsageMeta
}): void {
  logger.http({
    event: 'mcp-tool',
    tool,
    source: meta.source,
    traceId: meta.traceId,
    userId: meta.userId,
    args: summariseMcpToolArgs(args),
    status,
    'response-time': Date.now() - startedAt,
  })
}

/**
 * MCP tools run inside the chat stream, so Morgan never sees each call.
 */
export function wrapMcpToolsWithUsageLogs<T extends object>(
  tools: T,
  meta: McpToolUsageMeta,
): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, toolDef]) => {
      if (!hasExecute(toolDef)) {
        return [name, toolDef]
      }

      const execute = toolDef.execute
      return [
        name,
        {
          ...toolDef,
          execute: async (...executeArgs: never[]) => {
            const startedAt = Date.now()
            const args = executeArgs[0]
            try {
              const result = await execute(...executeArgs)
              logUsage({
                tool: name,
                args,
                status: isErrorResult(result) ? 'error' : 'success',
                startedAt,
                meta,
              })
              return result
            } catch (error) {
              logUsage({
                tool: name,
                args,
                status: 'error',
                startedAt,
                meta,
              })
              logger.warn('MCP tool failed', {
                tool: name,
                traceId: meta.traceId,
                error: error instanceof Error ? error.message : String(error),
              })
              throw error
            }
          },
        },
      ]
    }),
  ) as T
}
