import { ulid } from 'ulid'
import { beforeEach, describe, expect, it } from 'vitest'

import { selectAllRows } from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'

import {
  createTableRow,
  createTableRows,
  patchTableRow,
  updateTableRow,
} from '../table-row-functions'
import {
  cleanRowForComparison,
  createMultipleTestRows,
  createTestRowData,
  createTestSetup,
  TestSetup,
} from './table-row-test-utils'

describe('table-row-functions: update operations', () => {
  let setup: TestSetup

  beforeEach(async () => {
    setup = await createTestSetup()
  })

  describe('updateTableRow', () => {
    it('should update an existing row with new data', async () => {
      const dataArray = createMultipleTestRows(3, setup.testColumnIds)

      const rowIds = await createTableRows({
        tableId: setup.testTable.id,
        dataArray,
      })

      await updateTableRow({
        tableId: setup.testTable.id,
        rowId: rowIds[0],
        data: dataArray[1],
      })

      const dbRows = await selectAllRows(setup.testTable.id)
      const cleanedRow = cleanRowForComparison(dbRows[0])
      expect(cleanedRow).toEqual(dataArray[1])
    })

    it('should throw an error when attempting to update a non-existent row', async () => {
      const nonExistentRowId = ulid()

      await expect(
        updateTableRow({
          tableId: setup.testTable.id,
          rowId: nonExistentRowId,
          data: createTestRowData(setup.testColumnIds),
        }),
      ).rejects.toThrow('Row not found')
    })
  })

  describe('patchTableRow', () => {
    describe('set operation', () => {
      it('should partially update a row with set operation', async () => {
        const originalData = createTestRowData(setup.testColumnIds)
        const { rowId } = await createTableRow({
          tableId: setup.testTable.id,
          data: originalData,
        })

        const patchData = createTestRowData(setup.testColumnIds.slice(0, 2))

        await patchTableRow({
          tableId: setup.testTable.id,
          rowId,
          patchData: {
            set: patchData,
          },
        })

        const dbRows = await selectAllRows(setup.testTable.id)
        expect(dbRows[0]).toEqual(
          expect.objectContaining({ ...originalData, ...patchData }),
        )
      })
    })

    describe('add operation', () => {
      it('should update numeric values with add operation', async () => {
        const { rowId } = await createTableRow({
          tableId: setup.testTable.id,
          data: {
            [setup.testColumnIds[0]]: '10',
          },
        })

        const result = await patchTableRow({
          tableId: setup.testTable.id,
          rowId,
          patchData: {
            add: {
              [setup.testColumnIds[0]]: '5',
            },
          },
        })

        expect(result.data[setup.testColumnIds[0]]).toBe('15')

        const result2 = await patchTableRow({
          tableId: setup.testTable.id,
          rowId,
          patchData: {
            add: {
              [setup.testColumnIds[0]]: '4.5',
            },
          },
        })

        expect(result2.data[setup.testColumnIds[0]]).toBe('19.5')
      })

      it('should throw an error when using add operation with non-numeric value', async () => {
        const { rowId } = await createTableRow({
          tableId: setup.testTable.id,
          data: {
            [setup.testColumnIds[0]]: 'yorimo anata',
            [setup.testColumnIds[1]]: '123',
          },
        })

        await expect(
          patchTableRow({
            tableId: setup.testTable.id,
            rowId,
            patchData: {
              add: {
                [setup.testColumnIds[0]]: '123',
              },
            },
          }),
        ).rejects.toThrow()

        await expect(
          patchTableRow({
            tableId: setup.testTable.id,
            rowId,
            patchData: {
              add: {
                [setup.testColumnIds[1]]: 'not-a-number',
              },
            },
          }),
        ).rejects.toThrow('Invalid value for add operation')
      })
    })

    describe('subtract operation', () => {
      it('should update numeric values with subtract operation', async () => {
        const { rowId } = await createTableRow({
          tableId: setup.testTable.id,
          data: {
            [setup.testColumnIds[0]]: '10',
          },
        })

        const result = await patchTableRow({
          tableId: setup.testTable.id,
          rowId,
          patchData: {
            subtract: {
              [setup.testColumnIds[0]]: '5',
            },
          },
        })
        expect(result.data[setup.testColumnIds[0]]).toBe('5')

        const result2 = await patchTableRow({
          tableId: setup.testTable.id,
          rowId,
          patchData: {
            subtract: {
              [setup.testColumnIds[0]]: '4.5',
            },
          },
        })

        expect(result2.data[setup.testColumnIds[0]]).toBe('0.5')
      })
    })
  })
})
