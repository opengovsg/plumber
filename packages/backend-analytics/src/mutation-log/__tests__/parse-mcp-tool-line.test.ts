import { describe, expect, it } from 'vitest'

import { parseMcpToolLine, toMcpToolRow } from '../parse-mcp-tool-line'

const TIMESTAMP = '2026-11-05 03:12:45.123'

function line(message: Record<string, unknown>) {
  return {
    timestamp: TIMESTAMP,
    event: JSON.stringify({ level: 'http', message }),
  }
}

const callLine = (
  tool: string,
  args: Record<string, unknown>,
  status = 'success',
) =>
  line({
    event: 'mcp-tool',
    source: 'plumber',
    tool,
    traceId: 'trace-1',
    userId: 'Officer@Agency.gov.sg',
    args,
    status,
  })

const USERS = new Map([['officer@agency.gov.sg', 'user-1']])

function toRow(input: { timestamp: string; event: string | null }) {
  const call = parseMcpToolLine(input)
  return call && toMcpToolRow(call, USERS)
}

describe('toMcpToolRow', () => {
  it('records an edit to an existing step', () => {
    expect(
      toRow(
        callLine('update_step_parameters', {
          pipe_id: 'f1',
          step_id: 's1',
          parameters: { tableId: '[redacted]' },
        }),
      ),
    ).toEqual({
      ts: new Date('2026-11-05T03:12:45.123Z'),
      user_id: 'user-1',
      operation: 'mcp:update_step_parameters',
      flow_id: 'f1',
      step_id: 's1',
      table_id: null,
      connection_id: null,
      app_key: null,
      action_key: null,
      resource_id: null,
      http_status: 200,
    })
  })

  it('keeps the app-action of a new step, but not the previous step id', () => {
    expect(
      toRow(
        callLine('create_step', {
          pipe_id: 'f1',
          app_key: 'tiles',
          action_key: 'createTileRow',
          previous_step_id: 's0',
        }),
      ),
    ).toMatchObject({
      operation: 'mcp:create_step',
      flow_id: 'f1',
      step_id: null,
      app_key: 'tiles',
      action_key: 'createTileRow',
    })
  })

  it('lowercases the pipe, step and connection ids', () => {
    expect(
      toRow(
        callLine('update_step_parameters', {
          pipe_id: 'AAAAAAAA-0000-4000-8000-000000000001',
          step_id: 'BBBBBBBB-0000-4000-8000-000000000002',
          connection_id: 'CCCCCCCC-0000-4000-8000-000000000003',
        }),
      ),
    ).toMatchObject({
      flow_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      step_id: 'bbbbbbbb-0000-4000-8000-000000000002',
      connection_id: 'cccccccc-0000-4000-8000-000000000003',
    })
  })

  it('leaves register_connection to find its pipe through the step', () => {
    expect(
      toRow(
        callLine('register_connection', {
          pipe_id: 'stale-pipe',
          step_id: 's1',
          connection_id: 'c1',
        }),
      ),
    ).toMatchObject({
      operation: 'mcp:register_connection',
      flow_id: null,
      step_id: 's1',
      connection_id: 'c1',
    })
  })

  it('leaves the user empty when the email has no account', () => {
    const call = parseMcpToolLine(
      callLine('delete_step', { pipe_id: 'f1', step_id: 's1' }),
    )
    expect(call && toMcpToolRow(call, new Map())?.user_id).toBeNull()
  })

  it('marks a failed call with status 500', () => {
    expect(
      toRow(callLine('delete_step', { pipe_id: 'f1', step_id: 's1' }, 'error'))
        ?.http_status,
    ).toBe(500)
  })

  it.each([
    ['a read tool', callLine('get_flow', { pipe_id: 'f1' })],
    [
      'a GitBook tool',
      line({
        event: 'mcp-tool',
        source: 'gitbook',
        tool: 'create_step',
        status: 'success',
      }),
    ],
    ['another event', line({ event: 'graphql', tool: 'create_step' })],
    ['an unreadable event', { timestamp: TIMESTAMP, event: '{not json' }],
    [
      'a missing timestamp',
      { ...callLine('delete_step', {}), timestamp: 'garbage' },
    ],
  ])('drops %s', (_case, input) => {
    expect(parseMcpToolLine(input)).toBeNull()
  })
})
