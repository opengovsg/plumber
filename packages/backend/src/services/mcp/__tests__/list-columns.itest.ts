import { randomUUID } from 'crypto'

// packages/backend/src/services/mcp/__tests__/list-columns.itest.ts
import type { IApp, IJSONObject } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import Flow from '@/models/flow'
import Step from '@/models/step'
import TableColumnMetadata from '@/models/table-column-metadata'
import { createTableColumns } from '@/models/tiles/pg/table-column-functions'
import { createTable } from '@/models/tiles/pg/table-functions'
import User from '@/models/user'

import { listColumnsService } from '../list-columns'

// LetterSG's getTemplateFields and Databricks' databricks-list-table-columns
// both call live external APIs — stub just their `run` functions so the test
// still exercises the real, unmodified action/field schemas (subFields,
// required flags, dependency params) for createLetter/createDatabricksTableRow.
const mocks = vi.hoisted(() => ({
  getTemplateFieldsRun: vi.fn(),
  listTableColumnsRun: vi.fn(),
}))

vi.mock('@/apps', async (importOriginal) => {
  const real = await importOriginal<{ default: Record<string, IApp> }>()
  const replaceRun = (app: IApp, key: string, run: typeof vi.fn) => ({
    ...app,
    dynamicData: app.dynamicData?.map((d) =>
      d.key === key ? { ...d, run } : d,
    ),
  })
  return {
    default: {
      ...real.default,
      lettersg: replaceRun(
        real.default.lettersg,
        'getTemplateFields',
        mocks.getTemplateFieldsRun,
      ),
      databricks: replaceRun(
        real.default.databricks,
        'databricks-list-table-columns',
        mocks.listTableColumnsRun,
      ),
    },
  }
})

// Exercises the real Tiles app: `createTileRow`'s `rowData` multirow-multicol
// field has `columnId` (dropdown, sourced from the `listColumns` dynamic-data
// command) as its first subField, and `cellValue` (plain string) as its
// second — matching packages/backend/src/apps/tiles/actions/create-row/index.ts.
async function createTileWithColumns(userId: string, columnNames: string[]) {
  const user = await User.query().findById(userId)
  const table = await user.$relatedQuery('tables').insert({
    name: 'Test Tile',
    role: 'owner',
    db: 'pg',
  })
  await createTable(table.id, [])

  const columns = await Promise.all(
    columnNames.map((name, position) =>
      TableColumnMetadata.query().insertAndFetch({
        name,
        tableId: table.id,
        position,
      }),
    ),
  )
  await createTableColumns(
    table.id,
    columns.map((c) => c.id),
  )

  return { table, columns }
}

async function setupFlowAndStep(
  userId: string,
  appKey: string,
  key: string,
  parameters: IJSONObject = {},
  connectionId?: string,
) {
  const flow = await Flow.query().insertAndFetch({
    id: randomUUID(),
    userId,
    name: 'Test Flow',
    active: false,
  })
  await Step.query().insertAndFetch({
    id: randomUUID(),
    flowId: flow.id,
    appKey: null,
    key: null,
    type: 'trigger',
    position: 1,
    parameters: {},
    status: 'incomplete',
  })
  const step = await Step.query().insertAndFetch({
    id: randomUUID(),
    flowId: flow.id,
    appKey,
    key,
    connectionId,
    type: 'action',
    position: 2,
    parameters,
    status: 'incomplete',
  })
  return { flow, step }
}

describe('listColumnsService', () => {
  let user: User

  beforeEach(async () => {
    vi.clearAllMocks()
    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `list-columns-${randomUUID()}@example.com`,
    })
  })

  it('returns all columns when none are configured yet', async () => {
    const { table, columns } = await createTileWithColumns(user.id, [
      'Column A',
      'Column B',
      'Column C',
    ])
    const { step } = await setupFlowAndStep(user.id, 'tiles', 'createTileRow', {
      tableId: table.id,
      rowData: [],
    })

    const result = await listColumnsService({ user, stepId: step.id })

    expect(result).toEqual({
      columns: columns.map((c) => ({ id: c.id, name: c.name })),
      alreadyConfigured: [],
      truncated: false,
      valueRequired: false,
    })
  })

  it("supports LetterSG's createLetter action, and flags its value as required", async () => {
    mocks.getTemplateFieldsRun.mockResolvedValue({
      data: [
        { name: 'Recipient Name', value: 'Recipient Name' },
        { name: 'Amount', value: 'Amount' },
      ],
    })
    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'lettersg',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })
    const { step } = await setupFlowAndStep(
      user.id,
      'lettersg',
      'createLetter',
      { templateId: 'template-1', letterParams: [] },
      connection.id,
    )

    const result = await listColumnsService({ user, stepId: step.id })

    expect(result).toEqual({
      columns: [
        { id: 'Recipient Name', name: 'Recipient Name' },
        { id: 'Amount', name: 'Amount' },
      ],
      alreadyConfigured: [],
      truncated: false,
      valueRequired: true,
    })
    expect(mocks.getTemplateFieldsRun).toHaveBeenCalledOnce()
  })

  it("supports Databricks' createDatabricksTableRow action, and its value is not required", async () => {
    mocks.listTableColumnsRun.mockResolvedValue({
      data: [{ name: 'col1', value: 'col1' }],
    })
    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'databricks',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })
    const { step } = await setupFlowAndStep(
      user.id,
      'databricks',
      'createDatabricksTableRow',
      { tableName: 'my_table', rowData: [] },
      connection.id,
    )

    const result = await listColumnsService({ user, stepId: step.id })

    expect(result).toEqual({
      columns: [{ id: 'col1', name: 'col1' }],
      alreadyConfigured: [],
      truncated: false,
      valueRequired: false,
    })
    expect(mocks.listTableColumnsRun).toHaveBeenCalledOnce()
  })

  it('excludes columns already present in the saved rowData array', async () => {
    const { table, columns } = await createTileWithColumns(user.id, [
      'Column A',
      'Column B',
      'Column C',
    ])
    const { step } = await setupFlowAndStep(user.id, 'tiles', 'createTileRow', {
      tableId: table.id,
      rowData: [{ columnId: columns[1].id, cellValue: 'already set' }],
    })

    const result = await listColumnsService({ user, stepId: step.id })

    expect(result.columns).toEqual([
      { id: columns[0].id, name: columns[0].name },
      { id: columns[2].id, name: columns[2].name },
    ])
    expect(result.alreadyConfigured).toEqual([columns[1].id])
  })

  it('caps at 50 columns and sets truncated: true', async () => {
    const columnNames = Array.from({ length: 60 }, (_, i) => `Column ${i}`)
    const { table } = await createTileWithColumns(user.id, columnNames)
    const { step } = await setupFlowAndStep(user.id, 'tiles', 'createTileRow', {
      tableId: table.id,
      rowData: [],
    })

    const result = await listColumnsService({ user, stepId: step.id })

    expect(result.columns).toHaveLength(50)
    expect(result.truncated).toBe(true)
  })

  it('throws if the step is not a supported app/action', async () => {
    // Delay's `delayFor` action isn't in the list_columns allowlist, and has
    // no multirow-multicol argument at all either.
    const { step } = await setupFlowAndStep(user.id, 'delay', 'delayFor', {
      delayForUnit: 'minutes',
      delayForValue: 5,
    })

    await expect(listColumnsService({ user, stepId: step.id })).rejects.toThrow(
      'list_columns only supports',
    )
  })

  it('throws if the step is not a supported app/action, even with a matching field shape', async () => {
    // GatherSG's `updateCase` has a `caseFields` multirow-multicol field
    // whose first subField (`field`) is a dropdown backed by dynamic data
    // too — same structural shape as Tiles/Excel, but semantically case
    // fields, not spreadsheet columns. It must be rejected by the allowlist
    // rather than slipping through on shape alone.
    const { step } = await setupFlowAndStep(user.id, 'gathersg', 'updateCase', {
      caseUuid: 'some-case-uuid',
      caseFields: [],
    })

    await expect(listColumnsService({ user, stepId: step.id })).rejects.toThrow(
      'list_columns only supports',
    )
  })

  it('throws if the user does not have access to the step', async () => {
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `list-columns-intruder-${randomUUID()}@example.com`,
    })
    const { table } = await createTileWithColumns(user.id, ['Column A'])
    const { step } = await setupFlowAndStep(user.id, 'tiles', 'createTileRow', {
      tableId: table.id,
      rowData: [],
    })

    await expect(
      listColumnsService({ user: intruder, stepId: step.id }),
    ).rejects.toThrow('Step not found')
  })

  it('throws if the saved multirow-multicol value is not an array', async () => {
    const { table } = await createTileWithColumns(user.id, ['Column A'])
    const { step } = await setupFlowAndStep(user.id, 'tiles', 'createTileRow', {
      tableId: table.id,
      rowData: { columnId: 'not-an-array' },
    })

    await expect(listColumnsService({ user, stepId: step.id })).rejects.toThrow(
      "Saved value for 'rowData' is not an array",
    )
  })
})
