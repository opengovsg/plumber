import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'
import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import * as tableFunctions from '@/models/dynamodb/table-row/functions'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import createRowAction from '../../actions/create-row'

const createTableRowSpy = vi.spyOn(tableFunctions, 'createTableRow')

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
        key: createRowAction.key,
        position: 2,
        parameters: {
          tableId: dummyTable.id,
          rowData,
        },
      },
      app: {
        name: tiles.name,
      },
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('should allow owners to create row', async () => {
    await expect(createRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should allow editors to create row', async () => {
    $.user = editor
    await expect(createRowAction.run($)).resolves.toBeUndefined()
    expect($.setActionItem).toBeCalled()
  })

  it('should not allow viewers to create row', async () => {
    $.user = viewer
    await expect(createRowAction.run($)).rejects.toThrow(StepError)
  })

  it('should throw correct error if Tile deleted', async () => {
    $.user = editor
    await TableMetadata.query()
      .patch({
        deletedAt: new Date().toISOString(),
      })
      .where({ id: $.step.parameters.tableId })
    await expect(createRowAction.run($)).rejects.toThrow(StepError)
  })

  describe('GSI', () => {
    beforeEach(async () => {
      await TableColumnMetadata.query()
        .patch({
          config: {
            gsi: {
              status: 'ready',
              indexName: 'gsiString1',
              type: 'string',
            },
          },
        })
        .where({ id: dummyColumnIds[0] })
    })

    it('should call create row with GSI', async () => {
      await expect(createRowAction.run($)).resolves.toBeUndefined()
      const data = ($.step.parameters.rowData as any[]).reduce((acc, row) => {
        acc[row.columnId] = row.cellValue
        return acc
      }, {})
      expect(createTableRowSpy).toHaveBeenCalledWith({
        tableId: dummyTable.id,
        data,
        gsis: [{ indexName: 'gsiString1', columnIdToMap: dummyColumnIds[0] }],
      })
    })
  })
})
