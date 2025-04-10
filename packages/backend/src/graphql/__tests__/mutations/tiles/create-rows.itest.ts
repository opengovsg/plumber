import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import createRows from '@/graphql/mutations/tiles/create-rows'
import * as tableFunctions from '@/models/dynamodb/table-row/functions'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

const createTableRowsSpy = vi.spyOn(tableFunctions, 'createTableRows')
describe('create row mutation', () => {
  let context: Context
  let dummyTable: TableMetadata
  let dummyColumnIds: string[] = []
  let editor: User
  let viewer: User

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    const mockTable = await generateMockTable({
      userId: context.currentUser.id,
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    viewer = mockTable.viewer

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })
  })

  it('should create a large number of rows', async () => {
    const NUM_ROWS = 5000
    const dataArray = []
    for (let i = 0; i < NUM_ROWS; i++) {
      dataArray.push(generateMockTableRowData({ columnIds: dummyColumnIds }))
    }

    await createRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
          dataArray,
        },
      },
      context,
    )

    const { rows } = await tableFunctions.getTableRows({
      tableId: dummyTable.id,
      columnIds: dummyColumnIds,
    })
    expect(rows).toHaveLength(NUM_ROWS)
  })

  it('should maintain order of rows', async () => {
    const NUM_ROWS = 10
    const dataArray = []
    for (let i = 0; i < NUM_ROWS; i++) {
      dataArray.push(generateMockTableRowData({ columnIds: dummyColumnIds }))
    }

    await createRows(
      null,
      {
        input: {
          tableId: dummyTable.id,
          dataArray,
        },
      },
      context,
    )

    const { rows } = await tableFunctions.getTableRows({
      tableId: dummyTable.id,
      columnIds: dummyColumnIds,
    })
    expect(rows.map((row) => row.data[dummyColumnIds[0]])).toEqual(
      dataArray.map((data) => data[dummyColumnIds[0]]),
    )
  })

  it('should allow collaborators with edit rights to call this function', async () => {
    context.currentUser = editor
    await expect(
      createRows(
        null,
        {
          input: {
            tableId: dummyTable.id,
            dataArray: [{}],
          },
        },
        context,
      ),
    ).resolves.toBeDefined()
  })

  it('should throw an error if user does not have edit access', async () => {
    context.currentUser = viewer
    await expect(
      createRows(
        null,
        {
          input: {
            tableId: dummyTable.id,
            dataArray: [{}],
          },
        },
        context,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  describe('GSI', () => {
    beforeEach(async () => {
      await TableColumnMetadata.query()
        .patch({
          config: {
            gsi: { status: 'ready', indexName: 'gsiString1', type: 'string' },
          },
        })
        .where({ id: dummyColumnIds[0] })
    })
    it('should call createTableRows with gsis', async () => {
      await createRows(
        null,
        {
          input: {
            tableId: dummyTable.id,
            dataArray: [
              { [dummyColumnIds[0]]: null },
              { [dummyColumnIds[0]]: '' },
              { [dummyColumnIds[0]]: 'test2' },
            ],
          },
        },
        context,
      )
      expect(createTableRowsSpy).toHaveBeenCalledWith({
        tableId: dummyTable.id,
        dataArray: [
          { [dummyColumnIds[0]]: null },
          { [dummyColumnIds[0]]: '' },
          { [dummyColumnIds[0]]: 'test2' },
        ],
        gsis: [{ indexName: 'gsiString1', columnIdToMap: dummyColumnIds[0] }],
      })
    })
  })
})
