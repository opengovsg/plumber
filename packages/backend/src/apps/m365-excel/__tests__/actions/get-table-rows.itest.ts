import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Context from '@/types/express/context'

import m365Excel from '../..'
import getTableRowsAction from '../../actions/get-table-rows'

// Mock dependencies
const mocks = vi.hoisted(() => ({
  WorkbookSession: {
    acquire: vi.fn(),
    request: vi.fn(),
  },
  getTopNTableRows: vi.fn(),
  convertRowToHexEncodedRowRecord: vi.fn(),
  validateDynamicFieldsAndThrowError: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: {
    acquire: mocks.WorkbookSession.acquire,
  },
}))

vi.mock('../../common/get-top-n-table-rows', () => ({
  default: mocks.getTopNTableRows,
}))

vi.mock('../../common/validate-dynamic-fields', () => ({
  validateDynamicFieldsAndThrowError: mocks.validateDynamicFieldsAndThrowError,
}))

describe('getTableRowsAction', () => {
  // Test globals
  let context: Context
  let $: IGlobalVariable

  beforeEach(async () => {
    vi.resetAllMocks()
    context = await generateMockContext()

    // Setup mock global variable
    $ = {
      user: context.currentUser,
      flow: {
        id: '123',
        userId: context.currentUser.id,
      },
      step: {
        id: '123',
        appKey: m365Excel.name,
        key: getTableRowsAction.key,
        position: 2,
        parameters: {
          fileId: 'test-file-id',
          tableId: '{test-table-id}',
          lookupColumn: 'Column1',
          lookupValue: 'test-value',
        },
      },
      app: {
        name: m365Excel.name,
      },
      setActionItem: vi.fn(),
      http: {
        request: vi.fn(),
      },
    } as unknown as IGlobalVariable

    // Setup default mock implementations
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['Column1', 'Column2'],
      rows: [
        ['non-matching', 'data1'],
        ['test-value', 'data2'],
        ['test-value', 'data3'],
      ],
      headerSheetRowIndex: 0,
    })

    // Setup hex-encoded row record mock
    mocks.convertRowToHexEncodedRowRecord.mockImplementation(
      ({ row, columns }: { row: string[]; columns: string[] }) => {
        // Create a simple mock implementation that converts the row to a record
        const result: Record<string, { value: string; columnName: string }> = {}
        columns.forEach((col: string, index: number) => {
          const hexKey = Buffer.from(col).toString('hex')
          result[hexKey] = {
            value: row[index],
            columnName: col,
          }
        })
        return result
      },
    )
  })

  it('should throw an error if the lookup column does not exist', async () => {
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['OtherColumn', 'Column2'],
      rows: [['value1', 'data1']],
      headerSheetRowIndex: 0,
    })

    await expect(getTableRowsAction.run($)).rejects.toThrow(StepError)
  })

  it('should return foundRows: 0 when no matching rows are found', async () => {
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['Column1', 'Column2'],
      rows: [['non-matching', 'data1']],
      headerSheetRowIndex: 0,
    })

    $.step.parameters.lookupValue = 'test-value'
    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        columns: expect.arrayContaining([
          expect.objectContaining({
            id: Buffer.from('Column1').toString('hex'),
            name: 'Column1',
            value: '',
          }),
          expect.objectContaining({
            id: Buffer.from('Column2').toString('hex'),
            name: 'Column2',
            value: '',
          }),
        ]),
        rows: [],
        rowsFound: 0,
      },
    })
  })

  it('should return matching rows when found', async () => {
    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: expect.objectContaining({
        rowsFound: 2, // Two rows match 'test-value'
        columns: expect.arrayContaining([
          expect.objectContaining({
            id: Buffer.from('Column1').toString('hex'),
            name: 'Column1',
            value: 'test-value, test-value',
          }),
          expect.objectContaining({
            id: Buffer.from('Column2').toString('hex'),
            name: 'Column2',
            value: 'data2, data3',
          }),
        ]),
        rows: expect.any(Array),
      }),
    })

    // Verify the rowData contains the expected rows
    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const rowData = call.raw.rows

    expect(rowData).toHaveLength(2)
    expect(rowData[0].tableRowIndex).toBe(1)
    expect(rowData[0].sheetRowNumber).toBe(3) // headerSheetRowIndex(0) + rowIndex(1) + 2
    expect(rowData[1].tableRowIndex).toBe(2)
    expect(rowData[1].sheetRowNumber).toBe(4) // headerSheetRowIndex(0) + rowIndex(2) + 2
  })

  it('should handle invalid parameters', async () => {
    $.step.parameters.fileId = ''
    await expect(getTableRowsAction.run($)).rejects.toThrow(StepError)

    $.step.parameters.tableId = '!!!'
    await expect(getTableRowsAction.run($)).rejects.toThrow(StepError)
  })

  it('should handle case-sensitive matching', async () => {
    // Change the lookup value to be different case
    $.step.parameters.lookupValue = 'TEST-VALUE'

    await getTableRowsAction.run($)

    // Should not find any matches due to case sensitivity
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        columns: [
          {
            id: Buffer.from('Column1').toString('hex'),
            name: 'Column1',
            value: '',
          },
          {
            id: Buffer.from('Column2').toString('hex'),
            name: 'Column2',
            value: '',
          },
        ],
        rows: [],
        rowsFound: 0,
      },
    })
  })

  it('should find case-sensitive matches correctly', async () => {
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['Column1', 'Column2'],
      rows: [
        ['non-matching', 'data1'],
        ['TEST-VALUE', 'data2'],
        ['test-value', 'data3'],
      ],
      headerSheetRowIndex: 0,
    })
    // Change the lookup value to be different case
    $.step.parameters.lookupValue = 'TEST-VALUE'

    await getTableRowsAction.run($)

    // Should find the exact case match
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: expect.objectContaining({
        rowsFound: 1,
        columns: expect.arrayContaining([
          expect.objectContaining({
            id: Buffer.from('Column1').toString('hex'),
            name: 'Column1',
            value: 'TEST-VALUE',
          }),
          expect.objectContaining({
            id: Buffer.from('Column2').toString('hex'),
            name: 'Column2',
            value: 'data2',
          }),
        ]),
        rows: expect.any(Array),
      }),
    })
  })

  it('should limit returned rows to 500 when more matches are found', async () => {
    // Create an array of 600 matching rows
    const matchingRows = Array.from({ length: 600 }, (_, i) => [
      `test-value`,
      `data${i + 1}`,
    ])
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['Column1', 'Column2'],
      rows: matchingRows,
      headerSheetRowIndex: 0,
    })

    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: expect.objectContaining({
        rowsFound: 500, // Should be limited to 500 rows
        columns: expect.arrayContaining([
          expect.objectContaining({
            id: Buffer.from('Column1').toString('hex'),
            name: 'Column1',
            value: `test-value, ${Array.from(
              { length: 499 },
              (_) => `test-value`,
            ).join(', ')}`,
          }),
          expect.objectContaining({
            id: Buffer.from('Column2').toString('hex'),
            name: 'Column2',
            value: `data1, ${Array.from(
              { length: 499 },
              (_, i) => `data${i + 2}`,
            ).join(', ')}`,
          }),
        ]),
        rows: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            rowData: expect.any(Object),
            sheetRowNumber: expect.any(Number),
            tableRowIndex: expect.any(Number),
          }),
        ]),
      }),
    })

    // Verify the rowData contains exactly 500 rows
    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const rowData = call.raw.rows
    expect(rowData).toHaveLength(500)

    // Verify the first and last rows are correct
    expect(rowData[0].tableRowIndex).toBe(0)
    expect(rowData[0].sheetRowNumber).toBe(2) // headerSheetRowIndex(0) + rowIndex(0) + 2
    expect(rowData[499].tableRowIndex).toBe(499)
    expect(rowData[499].sheetRowNumber).toBe(501) // headerSheetRowIndex(0) + rowIndex(499) + 2
  })
})
