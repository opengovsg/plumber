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
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import tiles from '../..'
import findSingleRowAction from '../../actions/find-single-row'

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

  it('should now allow non-owners to find single row', async () => {
    $.user = viewer
    await expect(findSingleRowAction.run($)).rejects.toThrow(StepError)
    $.user = editor
    await expect(findSingleRowAction.run($)).rejects.toThrow(StepError)
  })
})
