import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import createRow from '@/graphql/mutations/tiles/create-row'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

describe('create row mutation', () => {
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
    })
    dummyTable = mockTable.table
    editor = mockTable.editor
    viewer = mockTable.viewer

    dummyColumnIds = await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 5,
    })
  })

  it('should create an empty row in a given table', async () => {
    const row = await createRow(
      null,
      {
        input: {
          tableId: dummyTable.id,
          data: {},
        },
      },
      context,
    )
    expect(row).toBeDefined()
  })

  it('should create a row with valid keys in a given table', async () => {
    const validData = generateMockTableRowData({ columnIds: dummyColumnIds })
    const row = await createRow(
      null,
      {
        input: {
          tableId: dummyTable.id,
          data: validData,
        },
      },
      context,
    )
    expect(row).toBeDefined()
  })

  it('should throw an error when creating a row with invalid keys', async () => {
    const invalidData = generateMockTableRowData({
      columnIds: [...dummyColumnIds, 'invalid_column_id'],
    })
    await expect(
      createRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            data: invalidData,
          },
        },
        context,
      ),
    ).rejects.toThrow()
  })

  it('should allow collaborators with edit rights to call this function', async () => {
    context.currentUser = editor
    await expect(
      createRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            data: {},
          },
        },
        context,
      ),
    ).resolves.toBeDefined()
  })

  it('should throw an error if user does not have edit access', async () => {
    context.currentUser = viewer
    await expect(
      createRow(
        null,
        {
          input: {
            tableId: dummyTable.id,
            data: {},
          },
        },
        context,
      ),
    ).rejects.toThrow(ForbiddenError)
  })
})
