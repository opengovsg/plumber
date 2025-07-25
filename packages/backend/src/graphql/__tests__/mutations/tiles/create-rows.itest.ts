import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import createRows from '@/graphql/mutations/tiles/create-rows'
import TableMetadata from '@/models/table-metadata'
import * as ddbTableRowFunctions from '@/models/tiles/dynamodb/table-row/functions'
import * as pgTableRowFunctions from '@/models/tiles/pg/table-row-functions'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

const pgCreateTableRowsSpy = vi.spyOn(pgTableRowFunctions, 'createTableRows')
const ddbCreateTableRowsSpy: ReturnType<typeof vi.spyOn> = vi.spyOn(
  ddbTableRowFunctions,
  'createTableRows',
)

describe.each([['pg'], ['ddb']])(
  'create rows mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let dummyColumnIds: string[]
    let editor: User
    let viewer: User

    // cant use before all here since the data is re-seeded each time
    beforeEach(async () => {
      context = await generateMockContext()

      const mockTable = await generateMockTable({
        userId: context.currentUser.id,
        databaseType: databaseType as 'ddb' | 'pg',
      })
      dummyTable = mockTable.table
      editor = mockTable.editor
      viewer = mockTable.viewer

      dummyColumnIds = await generateMockTableColumns({
        tableId: dummyTable.id,
        numColumns: 5,
        databaseType: databaseType as 'ddb' | 'pg',
      })

      pgCreateTableRowsSpy.mockClear()
      ddbCreateTableRowsSpy.mockClear()
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

      if (databaseType === 'pg') {
        expect(pgCreateTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          dataArray,
        })
        expect(ddbCreateTableRowsSpy).not.toHaveBeenCalled()
      } else {
        expect(ddbCreateTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          dataArray,
        })
        expect(pgCreateTableRowsSpy).not.toHaveBeenCalled()
      }
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

      if (databaseType === 'pg') {
        expect(pgCreateTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          dataArray,
        })
        expect(ddbCreateTableRowsSpy).not.toHaveBeenCalled()
        const result = await pgTableRowFunctions.getTableRows({
          tableId: dummyTable.id,
          columnIds: dummyColumnIds,
        })
        expect(result.rows.map((row) => row.data[dummyColumnIds[0]])).toEqual(
          dataArray.map((data) => data[dummyColumnIds[0]]),
        )
      } else {
        expect(ddbCreateTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          dataArray,
        })
        expect(pgCreateTableRowsSpy).not.toHaveBeenCalled()
        const result = await ddbTableRowFunctions.getTableRows({
          tableId: dummyTable.id,
          columnIds: dummyColumnIds,
        })
        expect(result.rows.map((row) => row.data[dummyColumnIds[0]])).toEqual(
          dataArray.map((data) => data[dummyColumnIds[0]]),
        )
      }
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
  },
)
