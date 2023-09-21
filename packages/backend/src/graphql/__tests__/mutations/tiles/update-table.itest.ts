import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import updateTable from '@/graphql/mutations/tiles/update-table'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('update table mutation', () => {
  let context: Context
  let dummyTable: TableMetadata
  let dummmyColumn: TableColumnMetadata

  // cant use before all here since the data is re-seeded each time
  beforeEach(async () => {
    context = {
      req: null,
      res: null,
      currentUser: await User.query().findOne({ email: 'tester@open.gov.sg' }),
    }

    dummyTable = await TableMetadata.query().insert({
      name: 'Test Table',
      userId: context.currentUser.id,
    })

    dummmyColumn = await dummyTable.$relatedQuery('columns').insert({
      name: 'Test Column',
    })
  })

  describe('table name changes', () => {
    it('is able to update table name', async () => {
      const newTableName = 'New Table Name'
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: newTableName,
            addedColumns: [],
            modifiedColumns: [],
            deletedColumns: [],
          },
        },
        context,
      )
      expect(updatedTable.name).toBe(newTableName)
    })

    it('will not amend table name if null or empty string', async () => {
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: null,
            addedColumns: [],
            modifiedColumns: [],
            deletedColumns: [],
          },
        },
        context,
      )
      expect(updatedTable.name).toBe('Test Table')

      const updatedTable2 = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: [],
            modifiedColumns: [],
            deletedColumns: [],
          },
        },
        context,
      )
      expect(updatedTable2.name).toBe('Test Table')
    })
  })

  describe('adding columns to table', () => {
    it('should add columns to table', async () => {
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: ['New Column 1', 'New Column 2'],
            modifiedColumns: [],
            deletedColumns: [],
          },
        },
        context,
      )
      const tableColumnCount = await updatedTable
        .$relatedQuery('columns')
        .resultSize()
      expect(tableColumnCount).toBe(3)
    })

    it('should add columns to table with same name', async () => {
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: ['New Column 1', 'New Column 1', 'New Column 1'],
            modifiedColumns: [],
            deletedColumns: [],
          },
        },
        context,
      )
      const tableColumnCount = await updatedTable
        .$relatedQuery('columns')
        .resultSize()
      expect(tableColumnCount).toBe(4)
    })
  })

  describe('modify columns in table', () => {
    it('should modify column name', async () => {
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: [],
            modifiedColumns: [
              {
                id: dummmyColumn.id,
                name: 'New Column Name',
              },
            ],
            deletedColumns: [],
          },
        },
        context,
      )
      expect(updatedTable.columns[0].name).toBe('New Column Name')
    })

    it('should fail if column does not exist', async () => {
      const updateTableAction = updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: [],
            modifiedColumns: [
              {
                id: randomUUID(),
                name: 'New Column Name',
              },
            ],
            deletedColumns: [],
          },
        },
        context,
      )

      await expect(updateTableAction).rejects.toThrow()
    })
  })

  describe('delete columns in table', () => {
    it('should delete columns', async () => {
      const updatedTable = await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: [],
            modifiedColumns: [],
            deletedColumns: [dummmyColumn.id],
          },
        },
        context,
      )
      const tableColumnCount = await updatedTable
        .$relatedQuery('columns')
        .resultSize()
      expect(tableColumnCount).toBe(0)
    })

    it('should not be able to delete a column from a different table', async () => {
      const dummyTable2 = await TableMetadata.query().insert({
        name: 'Test Table',
        userId: context.currentUser.id,
      })

      const dummmyColumn2 = await dummyTable2.$relatedQuery('columns').insert({
        name: 'Test Column',
      })
      await updateTable(
        null,
        {
          input: {
            id: dummyTable.id,
            name: '',
            addedColumns: [],
            modifiedColumns: [],
            deletedColumns: [dummmyColumn2.id],
          },
        },
        context,
      )
      const tableColumnCount = await dummyTable2
        .$relatedQuery('columns')
        .resultSize()
      expect(tableColumnCount).toBe(1)
    })
  })
})
