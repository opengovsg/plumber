import { beforeEach, describe, expect, it } from 'vitest'

import createRows from '@/graphql/mutations/tiles/create-rows'
import { getTableRows } from '@/models/dynamodb/table-row/functions'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

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

    const rows = await getTableRows({
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

    const rows = await getTableRows({
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
    ).rejects.toThrow('You do not have access to this tile')
  })
})
