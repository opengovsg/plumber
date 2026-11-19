import { describe, expect, it } from 'vitest'

import { summarizeFlowEdits } from '../flow-edit-daily'
import type { MutationLogRow } from '../parse-mutation-line'

function mutation(
  overrides: Partial<Omit<MutationLogRow, 'ts'>> & { ts: string },
): MutationLogRow {
  return {
    user_id: 'user-1',
    operation: 'updateStep',
    flow_id: 'flow-1',
    step_id: null,
    table_id: null,
    connection_id: null,
    app_key: null,
    action_key: null,
    resource_id: null,
    http_status: 200,
    ...overrides,
    ts: new Date(overrides.ts),
  }
}

describe('summarizeFlowEdits', () => {
  it('counts edits per pipe, user and operation, dated at Singapore midnight', () => {
    const rows = summarizeFlowEdits('2026-11-05', [
      mutation({ ts: '2026-11-05T03:00:00.000Z' }),
      mutation({ ts: '2026-11-04T16:30:00.000Z' }),
      mutation({ ts: '2026-11-05T01:00:00.000Z', operation: 'updateFlow' }),
      mutation({ ts: '2026-11-05T02:00:00.000Z', user_id: 'user-2' }),
      mutation({
        ts: '2026-11-05T02:30:00.000Z',
        user_id: 'user-3',
        operation: 'mcp:update_step_parameters',
      }),
    ])

    expect(rows).toEqual([
      {
        day: new Date('2026-11-04T16:00:00.000Z'),
        flow_id: 'flow-1',
        user_id: 'user-1',
        operation: 'updateFlow',
        edits: 1,
        first_edit_at: new Date('2026-11-05T01:00:00.000Z'),
        last_edit_at: new Date('2026-11-05T01:00:00.000Z'),
      },
      expect.objectContaining({
        user_id: 'user-1',
        operation: 'updateStep',
        edits: 2,
        first_edit_at: new Date('2026-11-04T16:30:00.000Z'),
        last_edit_at: new Date('2026-11-05T03:00:00.000Z'),
      }),
      expect.objectContaining({ user_id: 'user-2', edits: 1 }),
      expect.objectContaining({
        user_id: 'user-3',
        operation: 'mcp:update_step_parameters',
        edits: 1,
      }),
    ])
  })

  it('leaves out rows that cannot say who changed which pipe, and mutations that do not change it', () => {
    expect(
      summarizeFlowEdits('2026-11-05', [
        mutation({
          ts: '2026-11-05T01:00:00.000Z',
          operation: 'duplicateFlow',
        }),
        mutation({
          ts: '2026-11-05T01:00:00.000Z',
          operation: 'bulkRetryExecutions',
        }),
        mutation({
          ts: '2026-11-05T01:00:00.000Z',
          operation: 'mcp:delete_step',
          http_status: 500,
        }),
        mutation({ ts: '2026-11-05T01:00:00.000Z', flow_id: null }),
        mutation({ ts: '2026-11-05T01:00:00.000Z', user_id: null }),
        mutation({ ts: '2026-11-05T01:00:00.000Z', operation: null }),
      ]),
    ).toEqual([])
  })
})
