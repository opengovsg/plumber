import { ITableRow } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '@/errors/graphql-errors/not-found'
import getAllRows from '@/graphql/queries/tiles/get-all-rows'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '../../mutations/tiles/table.mock'

import { insertMockTableRows } from './table-row.mock'

describe.each([['ddb'], ['pg']])(
  'get all rows query: %s',
  (databaseType: DatabaseType) => {
    let context: Context
    let dummyTable: TableMetadata
    let dummyColumnIds: string[] = []
    let editor: User
    let viewer: User

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
    })

    it('should fetch all rows in a given table', async () => {
      const numRowsToInsert = 100
      await insertMockTableRows(
        dummyTable.id,
        numRowsToInsert,
        dummyColumnIds,
        databaseType,
      )

      const { rows } = await getAllRows(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      )
      expect(rows).toHaveLength(numRowsToInsert)
    })

    it('should return rows in ascending order of createdAt', async () => {
      // Insert rows in descending order of createdAt
      const numRowsToInsert = 10
      const rowIdsInserted = []
      // inserting 1 by 1 so createdAt is different

      const tableOperations = getTableOperations(databaseType)
      for (let i = 0; i < numRowsToInsert; i++) {
        const { rowId } = await tableOperations.createTableRow({
          tableId: dummyTable.id,
          data: {},
        })
        await new Promise((resolve) => setTimeout(resolve, 10))
        rowIdsInserted.push(rowId)
      }

      const { rows } = await getAllRows(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      )
      expect(rows.map((r: ITableRow) => r.rowId)).toEqual(rowIdsInserted)
    })

    it('should fetch all rows even if more than 1MB by pagination', async () => {
      // 1 randomly generated row is about 470 bytes
      // 10000 rows will be about 4.7MB
      const numRowsToInsert = 10000
      await insertMockTableRows(
        dummyTable.id,
        numRowsToInsert,
        dummyColumnIds,
        databaseType,
      )

      let cursor: string | null = null
      let rows: ITableRow[] = []
      do {
        const { rows: pageRows, stringifiedCursor } = await getAllRows(
          null,
          {
            tableId: dummyTable.id,
            stringifiedCursor: cursor,
          },
          context,
        )
        cursor = stringifiedCursor
        rows = rows.concat(pageRows)
      } while (cursor)
      expect(rows.length).toBe(numRowsToInsert)
    }, 100000)

    it('should return empty array if no rows', async () => {
      const { rows } = await getAllRows(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      )

      expect(rows).toHaveLength(0)
    })

    it('should strip keys that are not in table columns', async () => {
      const data = generateMockTableRowData({ columnIds: dummyColumnIds })
      // add a key that is not in the table columns

      const tableOperations = getTableOperations(databaseType)
      await tableOperations.createTableRow({
        tableId: dummyTable.id,
        data,
      })

      await dummyTable.$relatedQuery('columns').deleteById(dummyColumnIds[0])

      const { rows: returnedRows } = await getAllRows(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      )
      const rows = await Promise.all(returnedRows)

      expect(JSON.parse(rows[0].data).length).toBe(dummyColumnIds.length - 1)
    })

    it('should handle values with commas in them', async () => {
      const data = generateMockTableRowData({ columnIds: dummyColumnIds })
      // add a value with a comma in it
      data[dummyColumnIds[0]] = 'test,test'

      const tableOperations = getTableOperations(databaseType)
      await tableOperations.createTableRow({
        tableId: dummyTable.id,
        data,
      })

      const { rows: returnedRows } = await getAllRows(
        null,
        {
          tableId: dummyTable.id,
        },
        context,
      )
      const rows = await Promise.all(returnedRows)

      expect(JSON.parse(rows[0].data).length).toBe(dummyColumnIds.length)
    })

    it('should allow all collaborators to call this function', async () => {
      context.currentUser = editor
      await expect(
        getAllRows(
          null,
          {
            tableId: dummyTable.id,
          },
          context,
        ),
      ).resolves.toBeDefined()

      context.currentUser = viewer
      await expect(
        getAllRows(
          null,
          {
            tableId: dummyTable.id,
          },
          context,
        ),
      ).resolves.toBeDefined()
    })

    it('should throw an error if collaborator does not exist or is soft deleted', async () => {
      context.currentUser = editor
      await TableCollaborator.query()
        .delete()
        .where('table_id', dummyTable.id)
        .andWhere('user_id', editor.id)
      await expect(
        getAllRows(
          null,
          {
            tableId: dummyTable.id,
          },
          context,
        ),
      ).rejects.toThrow(NotFoundError)
    })

    describe('last accessed at', () => {
      it('should update last accessed at for current user', async () => {
        const oldLastAccessedAt = new Date().toISOString()
        await TableCollaborator.query()
          .patch({
            lastAccessedAt: oldLastAccessedAt,
          })
          .where('table_id', dummyTable.id)
          .andWhere('user_id', context.currentUser.id)
        await getAllRows(null, { tableId: dummyTable.id }, context)
        const { lastAccessedAt } = await TableCollaborator.query().findOne({
          table_id: dummyTable.id,
          user_id: context.currentUser.id,
        })
        expect(new Date(lastAccessedAt).getTime()).toBeGreaterThan(
          new Date(oldLastAccessedAt).getTime(),
        )
      })

      it('should not update last accessed at for admin operations', async () => {
        context.isAdminOperation = true
        const oldLastAccessedAt = new Date().toISOString()
        await TableCollaborator.query()
          .patch({
            lastAccessedAt: oldLastAccessedAt,
          })
          .where('table_id', dummyTable.id)
          .andWhere('user_id', context.currentUser.id)
        await getAllRows(null, { tableId: dummyTable.id }, context)
        const { lastAccessedAt } = await TableCollaborator.query().findOne({
          table_id: dummyTable.id,
          user_id: context.currentUser.id,
        })
        expect(new Date(lastAccessedAt).getTime()).toEqual(
          new Date(oldLastAccessedAt).getTime(),
        )
      })
    })
  },
)
