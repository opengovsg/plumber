import { describe, expect, it } from 'vitest'

import { templatizeTilesSteps } from '../templatize-tiles-steps'

const TILE_ID = '11111111-1111-1111-1111-111111111111'
const EMAIL_COL = '22222222-2222-2222-2222-222222222222'
const AMOUNT_COL = '33333333-3333-3333-3333-333333333333'
const FIND_STEP_ID = '44444444-4444-4444-4444-444444444444'

const SOURCE_TILE = {
  id: TILE_ID,
  name: 'Payments',
  columns: [
    { id: EMAIL_COL, name: 'Email' },
    { id: AMOUNT_COL, name: 'Amount (SGD)' },
  ],
}

const steps = [
  {
    position: 1,
    appKey: 'scheduler',
    parameters: {},
  },
  {
    position: 2,
    appKey: 'tiles',
    parameters: {
      tableId: TILE_ID,
      filters: [{ columnId: EMAIL_COL, operator: 'empty' }],
    },
  },
  {
    position: 3,
    appKey: 'postman',
    parameters: {
      body: `Owed {{step.${FIND_STEP_ID}.row.${AMOUNT_COL}}}`,
    },
  },
  {
    position: 4,
    appKey: 'tiles',
    parameters: {
      tableId: TILE_ID,
      rowData: [
        { columnId: AMOUNT_COL, cellValue: '0' },
        { columnId: 'deleted-column', cellValue: 'x' },
      ],
    },
  },
]

describe('templatizeTilesSteps', () => {
  const [trigger, find, email, update] = templatizeTilesSteps(steps, [
    SOURCE_TILE,
  ])

  it('attaches the column names to the first step using the tile', () => {
    expect(find.templateData).toEqual({
      name: 'Payments',
      columns: ['Email', 'Amount (SGD)'],
    })
    expect(update.templateData).toBeUndefined()
    expect(trigger.templateData).toBeUndefined()
  })

  it('points every step using the tile at the tile the first step creates', () => {
    expect(find.parameters.tableId).toBe('<<tile_table_id_2>>')
    expect(update.parameters.tableId).toBe('<<tile_table_id_2>>')
  })

  it('refers to columns by position', () => {
    expect(find.parameters.filters).toEqual([
      { columnId: '<<tile_col_pos_2.0>>', operator: 'empty' },
    ])
    expect(update.parameters.rowData).toEqual([
      { columnId: '<<tile_col_pos_2.1>>', cellValue: '0' },
      { columnId: '', cellValue: 'x' },
    ])
  })

  it('replaces column ids in variables of other apps', () => {
    expect(email.parameters.body).toBe(
      `Owed {{step.${FIND_STEP_ID}.row.<<tile_col_pos_2.1>>}}`,
    )
  })

  it('drops the tile and column ids when the source tile is missing', () => {
    const [, missingFind, missingEmail] = templatizeTilesSteps(steps, [])

    expect(missingFind.templateData).toBeUndefined()
    expect(missingFind.parameters.tableId).toBeUndefined()
    expect(missingFind.parameters.filters).toEqual([
      { columnId: '', operator: 'empty' },
    ])
    expect(missingEmail.parameters).toEqual(steps[2].parameters)
  })
})
