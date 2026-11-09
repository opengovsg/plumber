import { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import * as ddbTableRowFunctions from '@/models/tiles/dynamodb/table-row/functions'
import { getTableOperations } from '@/models/tiles/factory'
import * as pgTableRowFunctions from '@/models/tiles/pg/table-row-functions'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import updateRowAction from '../../actions/update-row'

describe.each([['ddb'], ['pg']])(
  'tiles update row action: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let dummyColumnIds: string[]
    let editor: User
    let viewer: User
    let $: IGlobalVariable

    beforeEach(async () => {
      context = await generateMockContext()

      const mockTable = await generateMockTable({
        userId: context.currentUser.id,
        databaseType,
      })
      dummyTable = mockTable.table
      editor = mockTable.editor
      viewer = mockTable.viewer

      dummyColumnIds = await generateMockTableColumns({
        tableId: dummyTable.id,
        numColumns: 5,
        databaseType,
      })

      const originalData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const tableOperations = getTableOperations(databaseType)
      const rowToUpdate = await tableOperations.createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })

      const validData = generateMockTableRowData({ columnIds: dummyColumnIds })
      const rowData = Object.keys(validData).map((columnId) => ({
        columnId,
        cellValue: validData[columnId],
      }))

      $ = {
        user: context.currentUser,
        flow: {
          id: '123',
          userId: context.currentUser.id,
        },
        step: {
          id: '456',
          appKey: tiles.name,
          key: updateRowAction.key,
          position: 2,
          parameters: {
            tableId: dummyTable.id,
            rowId: rowToUpdate.rowId,
            rowData,
          },
        },
        app: {
          name: tiles.name,
        },
        setActionItem: vi.fn(),
      } as unknown as IGlobalVariable
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should allow owners to update row', async () => {
      await expect(updateRowAction.run($)).resolves.toBeUndefined()
      expect($.setActionItem).toHaveBeenCalled()
    })

    it('should allow editors to update row', async () => {
      $.user = editor
      await expect(updateRowAction.run($)).resolves.toBeUndefined()
      expect($.setActionItem).toHaveBeenCalled()
    })

    it('should not allow viewers to update row', async () => {
      $.user = viewer
      await expect(updateRowAction.run($)).rejects.toThrow(StepError)
    })

    it('should throw error if no tableId', async () => {
      $.step.parameters.tableId = ''
      await expect(updateRowAction.run($)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Tile is required"'),
        kind: 'config',
      })
    })

    it('should throw correct error if Tile deleted', async () => {
      $.user = editor
      await TableMetadata.query()
        .patch({
          deletedAt: new Date().toISOString(),
        })
        .where({ id: $.step.parameters.tableId })
      await TableColumnMetadata.query()
        .patch({
          deletedAt: new Date().toISOString(),
        })
        .where({ table_id: $.step.parameters.tableId })
      await expect(updateRowAction.run($)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Tile not found"'),
        kind: 'config',
      })
    })

    it.each(['add', 'subtract'])(
      'should throw a config error if the %s value is not a number',
      async (operator) => {
        $.step.parameters.rowData = [
          { columnId: dummyColumnIds[0], cellValue: 'abc', operator },
        ]
        await expect(updateRowAction.run($)).rejects.toMatchObject({
          message: expect.stringContaining('"name":"Unable to update row"'),
          kind: 'config',
        })
      },
    )

    it('should rethrow a retriable error from the database', async () => {
      const retriableError = new RetriableError({
        error: 'Throughput exceeds the current capacity',
        delayInMs: 'default',
        delayType: 'step',
      })
      vi.spyOn(
        databaseType === 'ddb' ? ddbTableRowFunctions : pgTableRowFunctions,
        'patchTableRow',
      ).mockRejectedValueOnce(retriableError)
      await expect(updateRowAction.run($)).rejects.toBe(retriableError)
    })

    it('should throw an internal error if the database fails', async () => {
      vi.spyOn(
        databaseType === 'ddb' ? ddbTableRowFunctions : pgTableRowFunctions,
        'patchTableRow',
      ).mockRejectedValueOnce(new Error('DynamoDB Internal Error: boom'))
      await expect(updateRowAction.run($)).rejects.toMatchObject({
        message: expect.stringContaining('"name":"Failed to update row"'),
        kind: 'internal',
      })
    })

    it('should not fail if row does not exist', async () => {
      $.step.parameters.rowId = '123'
      await expect(updateRowAction.run($)).resolves.not.toThrow(StepError)
    })

    it('should not update columns that are not in the table', async () => {
      const data = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })

      const tableOperations = getTableOperations(databaseType)
      const row = await tableOperations.createTableRow({
        tableId: dummyTable.id,
        data,
      })
      $.step.parameters.rowId = row.rowId
      $.step.parameters.rowData = [
        { columnId: 'invalid_column', cellValue: '123' },
        { columnId: dummyColumnIds[0], cellValue: '123' },
      ]
      await updateRowAction.run($)
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          rowId: row.rowId,
          updated: true,
          row: {
            ...row.data,
            [dummyColumnIds[0]]: 123,
          },
        },
      })
    })
  },
)
