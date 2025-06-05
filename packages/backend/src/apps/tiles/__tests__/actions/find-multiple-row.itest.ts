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
import findMultipleRowsAction from '../../actions/find-multiple-rows'

const mocks = vi.hoisted(() => {
  const TILE_SCAN_LIMIT = 3
  return {
    TILE_SCAN_LIMIT,
    stepQueryResult: vi.fn().mockResolvedValue({
      config: {
        adminOverride: {
          tileScanLimit: TILE_SCAN_LIMIT,
        },
      },
    }),
  }
})

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    throwIfNotFound: mocks.stepQueryResult,
  },
}))

describe('findMultipleRowsAction', () => {
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

    const originalData = generateMockTableRowData({
      columnIds: dummyColumnIds,
    })

    for (let i = 0; i < 5; i++) {
      await createTableRow({
        tableId: dummyTable.id,
        data: originalData,
      })
    }

    $ = {
      user: context.currentUser,
      flow: {
        id: '123',
        userId: context.currentUser.id,
      },
      step: {
        id: '456',
        appKey: tiles.name,
        key: findMultipleRowsAction.key,
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
          order: 'asc',
        },
      },
      app: {
        name: tiles.name,
      },
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('should allow owners to find multiple rows', async () => {
    await expect(findMultipleRowsAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should allow editors to find multiple rows', async () => {
    $.user = editor
    await expect(findMultipleRowsAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should not allow viewers to find multiple rows', async () => {
    $.user = viewer
    await expect(findMultipleRowsAction.run($)).rejects.toThrow(StepError)
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
    await expect(findMultipleRowsAction.run($)).rejects.toThrow(StepError)
  })

  it('should call getTableRows with scan limit if exists in step config', async () => {
    const getTableRowsSpy = vi
      .spyOn(tableFunctions, 'getTableRows')
      .mockResolvedValueOnce({
        rows: [],
        stringifiedCursor: undefined,
      })
    await findMultipleRowsAction.run($)
    expect(getTableRowsSpy).toHaveBeenCalledWith({
      columnIds: dummyColumnIds,
      tableId: $.step.parameters.tableId,
      filters: $.step.parameters.filters,
      scanLimit: mocks.TILE_SCAN_LIMIT,
      order: 'asc',
    })
  })

  it('should limit the returned rows to 500 even if more rows match the conditions', async () => {
    const mockRows = Array(520)
      .fill(null)
      .map((_, i) => ({
        rowId: `row${i}`,
        data: generateMockTableRowData({ columnIds: dummyColumnIds }),
      }))

    vi.spyOn(tableFunctions, 'getTableRows').mockResolvedValueOnce({
      rows: mockRows,
      stringifiedCursor: undefined,
    })

    await findMultipleRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: expect.objectContaining({
        rowsFound: 500,
        data: expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({
              data: expect.any(Object),
              rowId: expect.any(String),
            }),
          ]),
          columns: expect.arrayContaining([
            expect.objectContaining({
              id: dummyColumnIds[0],
              name: 'Test Column 0',
              value: `data.rows.*.data.${dummyColumnIds[0]}`,
            }),
            expect.objectContaining({
              id: dummyColumnIds[1],
              name: 'Test Column 1',
              value: `data.rows.*.data.${dummyColumnIds[1]}`,
            }),
            expect.objectContaining({
              id: dummyColumnIds[2],
              name: 'Test Column 2',
              value: `data.rows.*.data.${dummyColumnIds[2]}`,
            }),
            expect.objectContaining({
              id: dummyColumnIds[3],
              name: 'Test Column 3',
              value: `data.rows.*.data.${dummyColumnIds[3]}`,
            }),
            expect.objectContaining({
              id: dummyColumnIds[4],
              name: 'Test Column 4',
              value: `data.rows.*.data.${dummyColumnIds[4]}`,
            }),
          ]),
        }),
      }),
    })

    const rows = ($.setActionItem as any).mock.calls[0][0].raw.data.rows

    expect(rows).toHaveLength(500)
    expect(rows[0].rowId).toBe('row0')
    expect(rows[499].rowId).toBe('row499')
  })
})
