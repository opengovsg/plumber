import { z } from 'zod'

import {
  type MutationLogRow,
  parseInsightsTimestamp,
} from './parse-mutation-line'

// AI builder tools that change a pipe. Reads, test runs and Tiles tools are left out.
export const MCP_EDIT_TOOLS = [
  'create_pipe',
  'create_step',
  'update_step_parameters',
  'delete_step',
  'unpublish_pipe',
  'register_connection',
] as const

export interface McpToolLine {
  timestamp: string
  // The whole log event, because Logs Insights flattens the nested args.
  event: string | null
}

const id = z.string().min(1).max(64)

const mcpToolEventSchema = z.object({
  message: z.object({
    event: z.literal('mcp-tool'),
    source: z.literal('plumber'),
    tool: z.enum(MCP_EDIT_TOOLS),
    // IMPORTANT: the usage log stores the user's email here, not their id.
    userId: z.string().min(1).max(320).optional(),
    status: z.enum(['success', 'error']),
    args: z
      .object({
        pipe_id: id.optional(),
        step_id: id.optional(),
        connection_id: id.optional(),
        app_key: id.optional(),
        action_key: id.optional(),
      })
      .optional(),
  }),
})

export interface McpToolCall {
  ts: Date
  tool: (typeof MCP_EDIT_TOOLS)[number]
  userEmail: string | null
  status: 'success' | 'error'
  args: NonNullable<z.infer<typeof mcpToolEventSchema>['message']['args']>
}

export function parseMcpToolLine(line: McpToolLine): McpToolCall | null {
  const ts = parseInsightsTimestamp(line.timestamp)
  if (!ts || !line.event) {
    return null
  }
  let raw: unknown
  try {
    raw = JSON.parse(line.event)
  } catch {
    return null
  }
  const parsed = mcpToolEventSchema.safeParse(raw)
  if (!parsed.success) {
    return null
  }
  const { tool, userId, status, args = {} } = parsed.data.message
  return {
    ts,
    tool,
    userEmail: userId ? userId.toLowerCase() : null,
    status,
    args,
  }
}

// create_step logs only the previous step, since the new step's id is in the result.
const TARGET_STEP_TOOLS = new Set([
  'update_step_parameters',
  'delete_step',
  'register_connection',
])

/**
 * Turns one AI builder tool call into a mutation log row. The operation is `mcp:<tool>`.
 *
 * The usage log redacts parameter values, so the row has no resource.
 */
export function toMcpToolRow(
  call: McpToolCall,
  userIdByEmail: Map<string, string>,
): MutationLogRow {
  const { ts, tool, userEmail, status, args } = call
  const isCreateStep = tool === 'create_step'
  return {
    ts,
    user_id: userEmail ? (userIdByEmail.get(userEmail) ?? null) : null,
    operation: `mcp:${tool}`,
    flow_id: args.pipe_id ?? null,
    step_id: TARGET_STEP_TOOLS.has(tool) ? (args.step_id ?? null) : null,
    table_id: null,
    connection_id: args.connection_id ?? null,
    app_key: isCreateStep ? (args.app_key ?? null) : null,
    action_key: isCreateStep ? (args.action_key ?? null) : null,
    resource_id: null,
    http_status: status === 'success' ? 200 : 500,
  }
}
