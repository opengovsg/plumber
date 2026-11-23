import { describe, expect, it } from 'vitest'

import {
  extractIds,
  parseRootField,
  parseVariables,
  recoverVariables,
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
    // The request log keeps one space from leading whitespace.
    [' mutation { logout }', 'logout'],
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
    // The editor's useReorderSteps payload, which has no pipe id.
    [
      'updateStepPositions',
      {
        input: {
          stepPositions: [
            { id: 's2', position: 2 },
            { id: 's3', position: 3 },
          ],
          flow: { updatedAt: '2026-11-04T15:59:00.000Z' },
        },
      },
      { step_id: 's2' },
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

const PARAMETERS = { 'tiles.createTileRow': 'tableId' }

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
    expect(toMutationLogRow(line, PARAMETERS)).toEqual({
      ts: new Date('2026-11-05T03:12:45.123Z'),
      user_id: 'user-1',
      operation: 'updateFlowStatus',
      flow_id: 'f1',
      step_id: null,
      table_id: null,
      connection_id: null,
      app_key: null,
      action_key: null,
      resource_id: null,
      http_status: 200,
    })
  })

  it('keeps the app-action and resource an updateStep set, and no other parameter', () => {
    const updateStep = {
      ...line,
      query:
        'mutation UpdateStep($input: UpdateStepInput!) { updateStep(input: $input) { id } }',
      variables: logged({
        input: {
          id: 's1',
          appKey: 'tiles',
          key: 'createTileRow',
          parameters: { tableId: 'table-1', rowData: 'Secret client list' },
        },
      }),
    }

    expect(toMutationLogRow(updateStep, PARAMETERS)).toMatchObject({
      operation: 'updateStep',
      step_id: 's1',
      app_key: 'tiles',
      action_key: 'createTileRow',
      resource_id: 'table-1',
    })
    expect(
      JSON.stringify(toMutationLogRow(updateStep, PARAMETERS)),
    ).not.toContain('Secret')
  })

  it('leaves the resource empty when it is templated or the action has none', () => {
    const updateStep = (appKey: string, key: string, parameters: object) => ({
      ...line,
      query:
        'mutation UpdateStep($input: UpdateStepInput!) { updateStep(input: $input) { id } }',
      variables: logged({ input: { id: 's1', appKey, key, parameters } }),
    })

    expect(
      toMutationLogRow(
        updateStep('tiles', 'createTileRow', { tableId: '{{step.a.id}}' }),
        PARAMETERS,
      )?.resource_id,
    ).toBeNull()
    expect(
      toMutationLogRow(
        updateStep('slack', 'findMessage', { channel: 'C1' }),
        PARAMETERS,
      )?.resource_id,
    ).toBeNull()
  })

  it('treats the anonymous user marker as no user', () => {
    expect(
      toMutationLogRow({ ...line, userId: '-' }, PARAMETERS)?.user_id,
    ).toBeNull()
  })

  it('keeps a row whose variables were redacted', () => {
    const row = toMutationLogRow(
      { ...line, variables: '[redacted]' },
      PARAMETERS,
    )
    expect(row?.operation).toBe('updateFlowStatus')
    expect(row?.flow_id).toBeNull()
  })

  it('drops a line without a readable timestamp', () => {
    expect(
      toMutationLogRow({ ...line, timestamp: 'not a time' }, PARAMETERS),
    ).toBeNull()
  })
})

describe('recoverVariables', () => {
  const STEP = '11111111-1111-4111-8111-111111111111'
  const FLOW = '22222222-2222-4222-8222-222222222222'
  const CONNECTION = '33333333-3333-4333-8333-333333333333'
  const TABLE = '44444444-4444-4444-8444-444444444444'
  const DECOY = '55555555-5555-4555-8555-555555555555'

  // The editor's updateStep input, in its field order. An apostrophe before a comma defeats restoreLoggedJson.
  const variables = logged({
    input: {
      id: STEP,
      key: 'createTileRow',
      parameters: {
        tableId: TABLE,
        note: "the students', parents",
        rows: [{ id: DECOY, key: 'decoy', flowId: DECOY, flow: { id: DECOY } }],
      },
      connection: { id: CONNECTION },
      flow: { id: FLOW, updatedAt: '2026-11-18T00:00:00.000Z' },
      config: { stepName: "Parents' list" },
      appKey: 'tiles',
    },
  })

  it('cannot parse the variables', () => {
    expect(parseVariables(variables)).toBeNull()
  })

  it('recovers only the fields at their input position', () => {
    expect(recoverVariables(variables)).toEqual({
      input: {
        id: STEP,
        key: 'createTileRow',
        connection: { id: CONNECTION },
        flow: { id: FLOW },
        appKey: 'tiles',
      },
    })
  })

  it('gives the row its ids, but never a parameter value', () => {
    const row = toMutationLogRow(
      {
        timestamp: '2026-11-05 03:12:45.123',
        query:
          'mutation UpdateStep($input: UpdateStepInput!) { updateStep(input: $input) { id } }',
        variables,
        userId: 'user-1',
        status: '200',
      },
      PARAMETERS,
    )

    expect(row).toMatchObject({
      flow_id: FLOW,
      step_id: STEP,
      table_id: null,
      connection_id: CONNECTION,
      app_key: 'tiles',
      action_key: 'createTileRow',
      resource_id: null,
    })
  })

  it('leaves out a field that is not in its expected place', () => {
    const noAppKey = logged({
      input: {
        id: STEP,
        key: 'createTileRow',
        parameters: { note: "students', parents", appKey: 'decoy' },
        connection: {},
        flow: { id: FLOW },
        config: {},
      },
    })

    expect(recoverVariables(noAppKey)).toEqual({
      input: { id: STEP, key: 'createTileRow', flow: { id: FLOW } },
    })
  })

  it('returns null for redacted variables', () => {
    expect(recoverVariables('[redacted]')).toBeNull()
  })
})
