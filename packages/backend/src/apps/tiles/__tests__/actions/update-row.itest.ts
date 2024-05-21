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
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import updateRowAction from '../../actions/update-row'

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

  it('should now allow non-owners to update row', async () => {
    $.user = viewer
    await expect(updateRowAction.run($)).rejects.toThrow(StepError)
    $.user = editor
    await expect(updateRowAction.run($)).rejects.toThrow(StepError)
  })
})
