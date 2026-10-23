import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const MCP_BRIDGE_TOOLS_PATH = join(
  __dirname,
  '../../../packages/backend/src/helpers/mcp-bridge-tools.ts',
)

/**
 * Tools that change state outside the chat. Gold rows must not let the model
 * call these without a confirmation turn in the input.
 */
export const SIDE_EFFECT_TOOLS = [
  'execute_step',
  'register_connection',
  'delete_step',
  'unpublish_pipe',
]

/**
 * Tool names the agent can call, read from the backend so the list cannot drift.
 * Returns null when the backend file is not present (for example in a shallow checkout).
 */
export function knownTools(source) {
  const text =
    source ??
    (existsSync(MCP_BRIDGE_TOOLS_PATH)
      ? readFileSync(MCP_BRIDGE_TOOLS_PATH, 'utf8')
      : null)
  if (text == null) {
    return null
  }
  const names = [...text.matchAll(/^\s{4}([a-z_]+): tool\b/gm)].map(
    (match) => match[1],
  )
  return [...new Set(names)]
}
