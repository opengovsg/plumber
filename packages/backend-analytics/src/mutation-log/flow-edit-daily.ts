import { sgtDayWindow } from '../sgt-day'
import type { ParquetColumns, SilverRow } from '../silver-table'
import type { MutationLogRow } from './parse-mutation-line'

export const FLOW_EDIT_DAILY_TABLE = 'flow_edit_daily'

export type FlowEditDailyRow = SilverRow & {
  day: Date
  flow_id: string
  user_id: string
  operation: string
  edits: number
  first_edit_at: Date
  last_edit_at: Date
}

export const FLOW_EDIT_DAILY_COLUMNS: ParquetColumns<FlowEditDailyRow> = {
  day: 'TIMESTAMP',
  flow_id: 'STRING',
  user_id: 'STRING',
  operation: 'STRING',
  edits: 'INT64',
  first_edit_at: 'TIMESTAMP',
  last_edit_at: 'TIMESTAMP',
}

// Other mutations name a pipe without changing it, such as duplicateFlow, run retries and sharing.
export const FLOW_EDIT_OPERATIONS: ReadonlySet<string> = new Set([
  'createStep',
  'updateStep',
  'deleteStep',
  'updateStepPositions',
  'duplicateBranch',
  'updateFlow',
  'updateFlowConfig',
  'updateFlowStatus',
  'deleteFlow',
  'mcp:create_step',
  'mcp:update_step_parameters',
  'mcp:delete_step',
  'mcp:unpublish_pipe',
])

/**
 * Counts one day's edit requests per pipe, user and operation.
 *
 * IMPORTANT: GraphQL reports a rejected request with HTTP 200, so a count includes rejected edits.
 * Only MCP rows report a failed call as an error status.
 */
export function summarizeFlowEdits(
  day: string,
  rows: MutationLogRow[],
): FlowEditDailyRow[] {
  const dayStart = sgtDayWindow(day).start
  const groups = new Map<string, FlowEditDailyRow>()

  for (const row of rows) {
    if (
      !row.flow_id ||
      !row.user_id ||
      !row.operation ||
      !FLOW_EDIT_OPERATIONS.has(row.operation) ||
      (row.http_status !== null && row.http_status >= 400)
    ) {
      continue
    }
    const key = `${row.flow_id}\u0000${row.user_id}\u0000${row.operation}`
    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        day: dayStart,
        flow_id: row.flow_id,
        user_id: row.user_id,
        operation: row.operation,
        edits: 1,
        first_edit_at: row.ts,
        last_edit_at: row.ts,
      })
      continue
    }
    group.edits += 1
    if (row.ts < group.first_edit_at) {
      group.first_edit_at = row.ts
    }
    if (row.ts > group.last_edit_at) {
      group.last_edit_at = row.ts
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.flow_id.localeCompare(b.flow_id) ||
      a.user_id.localeCompare(b.user_id) ||
      a.operation.localeCompare(b.operation),
  )
}
