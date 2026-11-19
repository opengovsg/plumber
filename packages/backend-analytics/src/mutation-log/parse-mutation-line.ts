import type { SilverRow } from '../silver-table'

export interface MutationLogLine {
  timestamp: string
  query: string | null
  variables: string | null
  userId: string | null
  status: string | null
}

export type MutationLogRow = SilverRow & {
  ts: Date
  user_id: string | null
  operation: string | null
  flow_id: string | null
  step_id: string | null
  table_id: string | null
  connection_id: string | null
  http_status: number | null
}

type Entity = 'flow' | 'step' | 'connection' | 'table'

// A bare input.id names the entity the mutation acts on.
const INPUT_ID_ENTITY: Record<string, Entity> = {
  updateFlow: 'flow',
  updateFlowStatus: 'flow',
  updateFlowConfig: 'flow',
  deleteFlow: 'flow',
  duplicateFlow: 'flow',
  updateStep: 'step',
  generateAuthUrl: 'connection',
  updateConnection: 'connection',
  replaceConnectionCredentials: 'connection',
  resetConnection: 'connection',
  verifyConnection: 'connection',
  deleteConnection: 'connection',
  updateTable: 'table',
  deleteTable: 'table',
}

const MAX_ID_LENGTH = 64

/**
 * Returns the first root field, e.g. `updateFlow`.
 *
 * The client picks the operation name freely, so the field is the reliable label.
 */
export function parseRootField(query: string | null): string | null {
  if (!query) {
    return null
  }
  const match = /^\s*mutation\b[^{]*\{\s*(?:\w+\s*:\s*)?(\w+)/.exec(query)
  return match?.[1] ?? null
}

/**
 * Restores the JSON that morgan logged with every `"` turned into `'`.
 *
 * IMPORTANT: a `'` is a string delimiter only next to JSON structure, because
 * JSON.stringify writes no spaces. Any other `'` is an apostrophe inside a value.
 */
export function restoreLoggedJson(logged: string): string {
  let out = ''
  for (let i = 0; i < logged.length; i++) {
    const ch = logged[i]
    if (ch === '\\') {
      const next = logged[i + 1] ?? ''
      out += next === "'" ? '\\"' : `\\${next}`
      i++
      continue
    }
    if (ch !== "'") {
      out += ch
      continue
    }
    const prev = logged[i - 1]
    const next = logged[i + 1]
    const isDelimiter =
      (prev !== undefined && '{[,:'.includes(prev)) ||
      (next !== undefined && ',}]:'.includes(next))
    out += isDelimiter ? '"' : "'"
  }
  return out
}

export function parseVariables(
  logged: string | null,
): Record<string, unknown> | null {
  if (!logged || logged === '-' || logged === '[redacted]') {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(restoreLoggedJson(logged))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asId(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
    ? value
    : null
}

function nestedId(value: unknown): string | null {
  return isRecord(value) ? asId(value.id) : null
}

export function extractIds(
  rootField: string | null,
  variables: Record<string, unknown> | null,
): Pick<MutationLogRow, 'flow_id' | 'step_id' | 'table_id' | 'connection_id'> {
  const input = isRecord(variables?.input) ? variables.input : {}
  const entity = rootField ? INPUT_ID_ENTITY[rootField] : undefined
  const inputId = (target: Entity) =>
    entity === target ? asId(input.id) : null
  const firstOf = (value: unknown) =>
    Array.isArray(value) ? asId(value[0]) : null

  return {
    flow_id: asId(input.flowId) ?? nestedId(input.flow) ?? inputId('flow'),
    step_id:
      asId(input.stepId) ??
      (rootField === 'deleteStep' ? firstOf(input.ids) : null) ??
      inputId('step'),
    table_id:
      asId(input.tableId) ?? asId(variables?.tableId) ?? inputId('table'),
    connection_id:
      asId(input.connectionId) ??
      nestedId(input.connection) ??
      inputId('connection'),
  }
}

// Logs Insights returns @timestamp as `YYYY-MM-DD HH:mm:ss.SSS` in UTC.
export function parseInsightsTimestamp(timestamp: string): Date | null {
  const date = new Date(`${timestamp.trim().replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseStatus(status: string | null): number | null {
  const value = Number(status)
  return Number.isInteger(value) && value > 0 ? value : null
}

/**
 * Keeps the operation and the ids only. No other variable leaves the log.
 */
export function toMutationLogRow(line: MutationLogLine): MutationLogRow | null {
  const ts = parseInsightsTimestamp(line.timestamp)
  if (!ts) {
    return null
  }
  const operation = parseRootField(line.query)
  return {
    ts,
    user_id: line.userId && line.userId !== '-' ? line.userId : null,
    operation,
    ...extractIds(operation, parseVariables(line.variables)),
    http_status: parseStatus(line.status),
  }
}
