import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import updateRow from '@/graphql/mutations/tiles/update-row'
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

const pgUpdateRowSpy = vi.spyOn(pgTableRowFunctions, 'updateTableRow')
const ddbUpdateRowSpy = vi.spyOn(ddbTableRowFunctions, 'updateTableRow')

describe.each([['ddb'], ['pg']])(
  'update row mutation: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let dummyColumnIds: string[]
    let editor: User
    let viewer: User
    let createTableRow:
      | typeof pgTableRowFunctions.createTableRow
      | typeof ddbTableRowFunctions.createTableRow
    let getRawRowById:
      | typeof pgTableRowFunctions.getRawRowById
      | typeof ddbTableRowFunctions.getRawRowById

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

      createTableRow =
        databaseType === 'ddb'
          ? ddbTableRowFunctions.createTableRow
          : pgTableRowFunctions.createTableRow

      getRawRowById =
        databaseType === 'ddb'
          ? ddbTableRowFunctions.getRawRowById
          : pgTableRowFunctions.getRawRowById

      pgUpdateRowSpy.mockClear()
      ddbUpdateRowSpy.mockClear()
    })

    it('should update a row in a given table', async () => {
      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const rowToUpdate = await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })

      const originalRow = await getRawRowById({
        rowId: rowToUpdate.rowId,
        tableId: dummyTable.id,
        columnIds: dummyColumnIds,
        includeTimestamps: true,
      })

      const newData = generateMockTableRowData({ columnIds: dummyColumnIds })

      const updatedId = await updateRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            rowId: rowToUpdate.rowId,
            data: newData,
          },
        },
        context,
      )

      const updatedRow = await getRawRowById({
        rowId: rowToUpdate.rowId,
        tableId: dummyTable.id,
        columnIds: dummyColumnIds,
        includeTimestamps: true,
      })
      expect(updatedId).toBe(rowToUpdate.rowId)
      expect(updatedRow.data).toEqual(newData)
      // check that createdAt does not change
      if ('createdAt' in updatedRow && 'createdAt' in originalRow) {
        expect(Number(updatedRow.createdAt)).toEqual(
          Number(originalRow.createdAt),
        )
      }

      if (databaseType === 'pg') {
        expect(pgUpdateRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowId: rowToUpdate.rowId,
          data: newData,
        })
      } else {
        expect(ddbUpdateRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          rowId: rowToUpdate.rowId,
          data: newData,
        })
      }
    })

    it('should set keys that are not specified in the updated data to null(not a patch operation)', async () => {
      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const rowToUpdate = await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })

      const newData = generateMockTableRowData({
        columnIds: dummyColumnIds.slice(2),
      })
      const updatedId = await updateRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            rowId: rowToUpdate.rowId,
            data: newData,
          },
        },
        context,
      )

      const { data: updatedRowData } = await getRawRowById({
        rowId: rowToUpdate.rowId,
        tableId: dummyTable.id,
        columnIds: dummyColumnIds,
      })
      expect(updatedId).toBe(rowToUpdate.rowId)
      for (const column of dummyColumnIds.slice(0, 2)) {
        expect(updatedRowData[column]).toBeNull()
      }
    })

    it('should throw an error if it tries to update a row with new invalid keys', async () => {
      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const rowToUpdate = await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })

      const newData = generateMockTableRowData({
        columnIds: [...dummyColumnIds, 'invalid_column'],
      })
      await expect(
        updateRow(
          null,
          {
            input: {
              tableId: dummyTable.id,
              rowId: rowToUpdate.rowId,
              data: newData,
            },
          },
          context,
        ),
      ).rejects.toThrow()
    })

    it('should throw an error if row id is not found', async () => {
      await expect(
        updateRow(
          null,
          {
            input: {
              tableId: dummyTable.id,
              rowId: 'random row id',
              data: {},
            },
          },
          context,
        ),
      ).rejects.toThrow()
    })

    it('should allow collaborators with edit rights to call this function', async () => {
      const rowToUpdate = await createTableRow({
        tableId: dummyTable.id,
        data: {},
      })
      const newData = generateMockTableRowData({ columnIds: dummyColumnIds })

      await expect(
        updateRow(
          null,
          {
            input: {
              tableId: dummyTable.id,
              rowId: rowToUpdate.rowId,
              data: newData,
            },
          },
          context,
        ),
      ).resolves.toEqual(rowToUpdate.rowId)
    })

    it('should throw an error if user does not have edit access', async () => {
      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
      const rowToUpdate = await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })
      const newData = generateMockTableRowData({ columnIds: dummyColumnIds })
      context.currentUser = editor
      await expect(
        updateRow(
          null,
          {
            input: {
              tableId: dummyTable.id,
              rowId: rowToUpdate.rowId,
              data: newData,
            },
          },
          context,
        ),
      ).resolves.toEqual(rowToUpdate.rowId)

      context.currentUser = viewer

      await expect(
        updateRow(
          null,
          {
            input: {
              tableId: dummyTable.id,
              rowId: rowToUpdate.rowId,
              data: newData,
            },
          },
          context,
        ),
      ).rejects.toThrow(ForbiddenError)
    })
  },
)
