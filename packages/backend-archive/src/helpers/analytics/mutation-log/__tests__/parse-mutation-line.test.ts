import { describe, expect, it } from 'vitest'

import {
  extractIds,
  parseRootField,
  parseVariables,
  toMutationLogRow,
} from '../parse-mutation-line'

// morgan logs the query and variables with every `"` turned into `'`.
const logged = (value: unknown) => JSON.stringify(value).replace(/"/g, "'")

describe('parseRootField', () => {
  it.each([
    [
      'mutation UpdateFlow($input: UpdateFlowInput!) { updateFlow(input: $input) { id } }',
      'updateFlow',
    ],
    ['mutation { logout }', 'logout'],
    [
      'mutation Rename($input: UpdateFlowInput!) { renamed: updateFlow(input: $input) { id } }',
      'updateFlow',
    ],
  ])('reads the root field of %s', (query, field) => {
    expect(parseRootField(query)).toBe(field)
  })

  it.each([null, '', 'query GetFlow { getFlow(id: 1) { id } }'])(
    'returns null for %s',
    (query) => {
      expect(parseRootField(query)).toBeNull()
    },
  )
})

describe('parseVariables', () => {
  it('reads ids from logged variables', () => {
    expect(parseVariables(logged({ input: { id: 'flow-1' } }))).toEqual({
      input: { id: 'flow-1' },
    })
  })

  it('keeps apostrophes inside values', () => {
    const variables = { input: { id: 'flow-1', name: "Kevin's pipe" } }
    expect(parseVariables(logged(variables))).toEqual(variables)
  })

  it('keeps escaped double quotes and backslashes inside values', () => {
    const variables = {
      input: { id: 'flow-1', name: 'say "hi"', path: 'C:\\' },
    }
    expect(parseVariables(logged(variables))).toEqual(variables)
  })

  it.each([null, '', '-', '[redacted]', "{'input':"])(
    'returns null for %s',
    (value) => {
      expect(parseVariables(value)).toBeNull()
    },
  )
})

describe('extractIds', () => {
  it.each([
    ['updateFlow', { input: { id: 'f1' } }, { flow_id: 'f1' }],
    ['deleteFlow', { input: { id: 'f1' } }, { flow_id: 'f1' }],
    [
      'updateStep',
      { input: { id: 's1', flow: { id: 'f1' }, connection: { id: 'c1' } } },
      { flow_id: 'f1', step_id: 's1', connection_id: 'c1' },
    ],
    [
      'createStep',
      { input: { flow: { id: 'f1' }, previousStep: { id: 's0' } } },
      { flow_id: 'f1' },
    ],
    [
      'deleteStep',
      { input: { ids: ['s1', 's2'], flow: { id: 'f1' } } },
      { flow_id: 'f1', step_id: 's1' },
    ],
    ['executeStep', { input: { stepId: 's1' } }, { step_id: 's1' }],
    ['updateConnection', { input: { id: 'c1' } }, { connection_id: 'c1' }],
    [
      'registerConnection',
      { input: { connectionId: 'c1', flowId: 'f1' } },
      { flow_id: 'f1', connection_id: 'c1' },
    ],
    ['updateTable', { input: { id: 't1' } }, { table_id: 't1' }],
    ['createRow', { input: { tableId: 't1' } }, { table_id: 't1' }],
    ['createShareableTableLink', { tableId: 't1' }, { table_id: 't1' }],
    ['updateFlowTransferStatus', { input: { id: 'transfer-1' } }, {}],
  ])('reads the ids of %s', (rootField, variables, expected) => {
    expect(extractIds(rootField, variables)).toEqual({
      flow_id: null,
      step_id: null,
      table_id: null,
      connection_id: null,
      ...expected,
    })
  })

  it('ignores values that are not short strings', () => {
    expect(
      extractIds('updateFlow', { input: { id: 'x'.repeat(65) } }).flow_id,
    ).toBeNull()
    expect(extractIds('updateFlow', { input: { id: 42 } }).flow_id).toBeNull()
  })
})

describe('toMutationLogRow', () => {
  const line = {
    timestamp: '2026-11-05 03:12:45.123',
    query:
      'mutation UpdateFlowStatus($input: UpdateFlowStatusInput!) { updateFlowStatus(input: $input) { id } }',
    variables: logged({
      input: { id: 'f1', active: true, name: 'Secret client list' },
    }),
    userId: 'user-1',
    status: '200',
  }

  it('keeps the operation and the ids, and no other variable', () => {
    expect(toMutationLogRow(line)).toEqual({
      ts: new Date('2026-11-05T03:12:45.123Z'),
      user_id: 'user-1',
      operation: 'updateFlowStatus',
      flow_id: 'f1',
      step_id: null,
      table_id: null,
      connection_id: null,
      http_status: 200,
    })
  })

  it('treats the anonymous user marker as no user', () => {
    expect(toMutationLogRow({ ...line, userId: '-' })?.user_id).toBeNull()
  })

  it('keeps a row whose variables were redacted', () => {
    const row = toMutationLogRow({ ...line, variables: '[redacted]' })
    expect(row?.operation).toBe('updateFlowStatus')
    expect(row?.flow_id).toBeNull()
  })

  it('drops a line without a readable timestamp', () => {
    expect(toMutationLogRow({ ...line, timestamp: 'not a time' })).toBeNull()
  })
})
