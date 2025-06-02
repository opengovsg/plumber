import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import createRow from '@/graphql/mutations/tiles/create-row'
import TableMetadata from '@/models/table-metadata'
import * as ddbTableRowFunctions from '@/models/tiles/dynamodb/table-row/functions'
import * as pgTableRowFunctions from '@/models/tiles/pg/table-row-functions'
import { DatabaseType } from '@/models/tiles/types'
import User from '@/models/user'
import Context from '@/types/express/context'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from './table.mock'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

const pgCreateTableRowSpy = vi.spyOn(pgTableRowFunctions, 'createTableRow')
const ddbCreateTableRowSpy = vi.spyOn(ddbTableRowFunctions, 'createTableRow')

describe.each([['ddb'], ['pg']])(
  'create row mutation: %s',
  (databaseType: DatabaseType) => {
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

      pgCreateTableRowSpy.mockClear()
      ddbCreateTableRowSpy.mockClear()
    })

    it('should create an empty row in a given table', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

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

      if (databaseType === 'pg') {
        expect(pgCreateTableRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          data: {},
        })
        expect(ddbCreateTableRowSpy).not.toHaveBeenCalled()
      } else {
        expect(ddbCreateTableRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          data: {},
        })
        expect(pgCreateTableRowSpy).not.toHaveBeenCalled()
      }
    })

    it('should create a row with valid keys in a given table', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

      const validData = generateMockTableRowData({
        columnIds: dummyColumnIds,
      })
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

      if (databaseType === 'pg') {
        expect(pgCreateTableRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          data: validData,
        })
        expect(ddbCreateTableRowSpy).not.toHaveBeenCalled()
      } else {
        expect(ddbCreateTableRowSpy).toHaveBeenCalledWith({
          tableId: dummyTable.id,
          data: validData,
        })
        expect(pgCreateTableRowSpy).not.toHaveBeenCalled()
      }
    })

    it('should throw an error when creating a row with invalid keys', async () => {
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)

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
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
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
      mocks.getLdFlagValue.mockResolvedValueOnce(databaseType)
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
  },
)
