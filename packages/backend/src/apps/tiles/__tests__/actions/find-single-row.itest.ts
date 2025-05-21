import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { createTableRow, TableRowFilter } from '@/models/dynamodb/table-row'
import * as tableFunctions from '@/models/dynamodb/table-row/functions'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import findSingleRowAction from '../../actions/find-single-row'

const mocks = vi.hoisted(() => ({
  stepQueryResult: vi.fn().mockResolvedValue({
    config: {
      adminOverride: {
        tileScanLimit: 100,
      },
    },
  }),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    throwIfNotFound: mocks.stepQueryResult,
  },
}))

describe('tiles create row action', () => {
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

    await createTableRow({
      tableId: dummyTable.id,
      data: originalData,
    })

    $ = {
      user: context.currentUser,
      flow: {
        id: '123',
        userId: context.currentUser.id,
      },
      step: {
        id: '456',
        appKey: tiles.name,
        key: findSingleRowAction.key,
        position: 2,
        parameters: {
          tableId: dummyTable.id,
          filters: [
            {
              columnId: dummyColumnIds[0],
              operator: 'equals',
              value: originalData[dummyColumnIds[0]],
            },
          ] as TableRowFilter[],
        },
      },
      app: {
        name: tiles.name,
      },
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('should allow owners to find single row', async () => {
    await expect(findSingleRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should allow editors to find single row', async () => {
    $.user = editor
    await expect(findSingleRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should not allow viewers to find single row', async () => {
    $.user = viewer
    await expect(findSingleRowAction.run($)).rejects.toThrow(StepError)
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
    await expect(findSingleRowAction.run($)).rejects.toThrow(StepError)
  })

  it('should call getTableRows with scan limit if exists in step config', async () => {
    const getTableRowsSpy = vi
      .spyOn(tableFunctions, 'getTableRows')
      .mockResolvedValueOnce({
        rows: [],
        stringifiedCursor: undefined,
      })
    await findSingleRowAction.run($)
    expect(getTableRowsSpy).toHaveBeenCalledWith({
      tableId: $.step.parameters.tableId,
      filters: $.step.parameters.filters,
      scanLimit: 100,
      order: 'asc',
    })
  })

  it('should call getTableRows with scan limit and order', async () => {
    const getTableRowsSpy = vi
      .spyOn(tableFunctions, 'getTableRows')
      .mockResolvedValueOnce({
        rows: [],
        stringifiedCursor: undefined,
      })
    $.step.parameters.returnLastRow = true
    await findSingleRowAction.run($)
    expect(getTableRowsSpy).toHaveBeenCalledWith({
      tableId: $.step.parameters.tableId,
      filters: $.step.parameters.filters,
      scanLimit: 100,
      order: 'desc',
    })
  })

  it('should return an empty columns if no rows are found', async () => {
    const filters = $.step.parameters.filters as TableRowFilter[]
    filters[0].value = 'not a valid value'
    await expect(findSingleRowAction.run($)).resolves.toBeUndefined()
    const emptyRow = dummyColumnIds.reduce((acc, c) => {
      acc[c] = ''
      return acc
    }, {} as Record<string, string>)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        rowsFound: 0,
        rowId: ' ',
        row: emptyRow,
      },
    })
  })
})
