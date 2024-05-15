import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import deleteTable from '@/graphql/mutations/tiles/delete-table'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from './table.mock'

describe('delete table mutation', () => {
  let context: Context
  let dummyTable: TableMetadata
  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = await generateMockContext()

    dummyTable = await generateMockTable({
      userId: context.currentUser.id,
    })

    await generateMockTableColumns({
      tableId: dummyTable.id,
      numColumns: 2,
    })
  })

  it('should delete table and columns', async () => {
    const success = await deleteTable(
      null,
      { input: { id: dummyTable.id } },
      context,
    )
    const tableColumnCount = await dummyTable
      .$relatedQuery('columns')
      .resultSize()

    const deletedTable = await TableMetadata.query().findById(dummyTable.id)
    expect(success).toBe(true)
    expect(deletedTable).toBeUndefined()
    expect(tableColumnCount).toBe(0)
  })

  it('should throw an error if table is not found', async () => {
    const deleteTableAction = deleteTable(
      null,
      { input: { id: randomUUID() } },
      context,
    )

    await expect(deleteTableAction).rejects.toThrow()
  })

  it('should throw an error if user is not the owner', async () => {
    context.currentUser = await User.query().findOne({
      email: 'viewer@open.gov.sg',
    })
    await expect(
      deleteTable(null, { input: { id: dummyTable.id } }, context),
    ).rejects.toThrow('You do not have access to this tile')

    context.currentUser = await User.query().findOne({
      email: 'editor@open.gov.sg',
    })
    await expect(
      deleteTable(null, { input: { id: dummyTable.id } }, context),
    ).rejects.toThrow('You do not have access to this tile')
  })
})
