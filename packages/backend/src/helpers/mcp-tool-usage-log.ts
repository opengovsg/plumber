import logger from '@/helpers/logger'

export type McpToolSource = 'plumber' | 'gitbook'

type McpToolUsageMeta = {
  source: McpToolSource
  traceId: string
  userId?: string
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
    args,
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
