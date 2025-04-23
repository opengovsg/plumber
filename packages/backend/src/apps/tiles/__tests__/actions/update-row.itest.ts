import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { createTableRow } from '@/models/dynamodb/table-row'
import * as tableFunctions from '@/models/dynamodb/table-row/functions'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import updateRowAction from '../../actions/update-row'

const patchTableRowSpy = vi.spyOn(tableFunctions, 'patchTableRow')

describe('tiles update row action', () => {
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
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    viewer = mockTable.viewer

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })

    const originalData = generateMockTableRowData({ columnIds: dummyColumnIds })

    const rowToUpdate = await createTableRow({
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

  it('should allow owners to update row', async () => {
    await expect(updateRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should allow editors to update row', async () => {
    $.user = editor
    await expect(updateRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should not allow viewers to update row', async () => {
    $.user = viewer
    await expect(updateRowAction.run($)).rejects.toThrow(StepError)
  })

  it('should throw error if no tableId', async () => {
    $.step.parameters.tableId = ''
    await expect(updateRowAction.run($)).rejects.toThrow(StepError)
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
    await expect(updateRowAction.run($)).rejects.toThrow(StepError)
  })

  it('should not fail if row does not exist', async () => {
    $.step.parameters.rowId = '123'
    await expect(updateRowAction.run($)).resolves.not.toThrow(StepError)
  })

  it('should not update columns that are not in the table', async () => {
    const data = generateMockTableRowData({
      columnIds: dummyColumnIds,
    })
    const row = await createTableRow({ tableId: dummyTable.id, data })
    $.step.parameters.rowId = row.rowId
    $.step.parameters.rowData = [
      { columnId: 'invalid_column', cellValue: '123' },
      { columnId: dummyColumnIds[0], cellValue: '123' },
    ]
    await updateRowAction.run($)
    expect($.setActionItem).toBeCalledWith({
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

    it('should update row with GSI', async () => {
      await expect(updateRowAction.run($)).resolves.toBeUndefined()
      expect(patchTableRowSpy).toHaveBeenCalledWith({
        tableId: dummyTable.id,
        rowId: $.step.parameters.rowId,
        patchData: {
          subtract: {},
          add: {},
          set: ($.step.parameters.rowData as any[]).reduce((acc, row) => {
            acc[row.columnId] = row.cellValue
            return acc
          }, {} as Record<string, string>),
        },
        gsis: [{ indexName: 'gsiString1', columnIdToMap: dummyColumnIds[0] }],
      })
    })
  })
})
