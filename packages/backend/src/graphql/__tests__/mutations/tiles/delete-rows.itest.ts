import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import deleteRows from '@/graphql/mutations/tiles/delete-rows'
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

const pgDeleteTableRowsSpy = vi.spyOn(pgTableRowFunctions, 'deleteTableRows')
const ddbDeleteTableRowsSpy = vi.spyOn(ddbTableRowFunctions, 'deleteTableRows')

const NUM_ROWS_TO_GENERATE = 35
describe.each([['pg'], ['ddb']])(
  'delete rows mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let rowIds: string[] = []
    let editor: User
    let viewer: User

    beforeEach(async () => {
      context = await generateMockContext()

      const mockTable = await generateMockTable({
        userId: context.currentUser.id,
        databaseType: databaseType as 'ddb' | 'pg',
      })
      dummyTable = mockTable.table
      editor = mockTable.editor
      viewer = mockTable.viewer

      const columnIds = await generateMockTableColumns({
        tableId: dummyTable.id,
        numColumns: 5,
        databaseType: databaseType as 'ddb' | 'pg',
      })

      // populate with rows
      const dataArray = new Array(NUM_ROWS_TO_GENERATE)
        .fill(null)
        .map(() => generateMockTableRowData({ columnIds }))

      if (databaseType === 'ddb') {
        rowIds = await ddbTableRowFunctions.createTableRows({
          tableId: dummyTable.id,
          dataArray,
        })
      } else {
        rowIds = await pgTableRowFunctions.createTableRows({
          tableId: dummyTable.id,
          dataArray,
        })
      }

      pgDeleteTableRowsSpy.mockClear()
      ddbDeleteTableRowsSpy.mockClear()
    })

    it('should delete rows with given ids', async () => {
      const slicedRows = rowIds.slice(0, 5)

      const success = await deleteRows(
        null,
        { input: { tableId: dummyTable.id, rowIds: slicedRows } },
        context,
      )
      expect(success).toEqual(slicedRows)

      if (databaseType === 'pg') {
        expect(pgDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds: slicedRows,
        })
        expect(ddbDeleteTableRowsSpy).not.toHaveBeenCalled()

        const count = await pgTableRowFunctions.getTableRowCount({
          tableId: dummyTable.id,
        })
        expect(count).toEqual(NUM_ROWS_TO_GENERATE - 5)
      } else {
        expect(ddbDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds: slicedRows,
        })
        expect(pgDeleteTableRowsSpy).not.toHaveBeenCalled()

        const count = await ddbTableRowFunctions.getTableRowCount({
          tableId: dummyTable.id,
        })
        expect(count).toEqual(NUM_ROWS_TO_GENERATE - 5)
      }
    })

    it('should be able to delete more than 25 rows', async () => {
      const success = await deleteRows(
        null,
        { input: { tableId: dummyTable.id, rowIds } },
        context,
      )
      expect(success).toEqual(rowIds)

      if (databaseType === 'pg') {
        expect(pgDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds,
        })
        expect(ddbDeleteTableRowsSpy).not.toHaveBeenCalled()

        const count = await pgTableRowFunctions.getTableRowCount({
          tableId: dummyTable.id,
        })
        expect(count).toEqual(0)
      } else {
        expect(ddbDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds,
        })
        expect(pgDeleteTableRowsSpy).not.toHaveBeenCalled()

        const count = await ddbTableRowFunctions.getTableRowCount({
          tableId: dummyTable.id,
        })
        expect(count).toEqual(0)
      }
    })

    it('should not throw an error if row id does not exist', async () => {
      const invalidRowIds = ['invalid row id 123', 'invalid row id 456']

      await expect(
        deleteRows(
          null,
          { input: { tableId: dummyTable.id, rowIds: invalidRowIds } },
          context,
        ),
      ).resolves.toEqual(invalidRowIds)

      if (databaseType === 'pg') {
        expect(pgDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds: invalidRowIds,
        })
        expect(ddbDeleteTableRowsSpy).not.toHaveBeenCalled()
      } else {
        expect(ddbDeleteTableRowsSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowIds: invalidRowIds,
        })
        expect(pgDeleteTableRowsSpy).not.toHaveBeenCalled()
      }
    })

    it('should allow collaborators with edit rights to call this function', async () => {
      const slicedRows = rowIds.slice(0, 5)

      context.currentUser = editor
      await expect(
        deleteRows(
          null,
          { input: { tableId: dummyTable.id, rowIds: slicedRows } },
          context,
        ),
      ).resolves.toEqual(slicedRows)
    })

    it('should throw an error if user does not have edit access', async () => {
      const slicedRows = rowIds.slice(0, 5)

      context.currentUser = viewer
      await expect(
        deleteRows(
          null,
          { input: { tableId: dummyTable.id, rowIds: slicedRows } },
          context,
        ),
      ).rejects.toThrow(ForbiddenError)
    })
  },
)
