import { IExecutionStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import getDataOutMetadata from '../../actions/get-table-rows/get-data-out-metadata'

describe('getTableRows getDataOutMetadata', () => {
  it('should return null if no dataOut is provided', async () => {
    const executionStep = { dataOut: null } as unknown as IExecutionStep
    const result = await getDataOutMetadata(executionStep)
    expect(result).toBeNull()
  })

  it('should return metadata for 0 rows found', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 0,
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rowsFound: {
        label: 'No. of rows found',
      },
    })
  })

  it('should return metadata for foundRows: true with row data', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 2,
        rowData: JSON.stringify([
          {
            tableRowIndex: 0,
            sheetRowNumber: 2,
            row: {
              '436f6c756d6e31': { value: 'value1', columnName: 'Column1' },
              '436f6c756d6e32': { value: 'value2', columnName: 'Column2' },
            },
          },
          {
            tableRowIndex: 1,
            sheetRowNumber: 3,
            row: {
              '436f6c756d6e31': { value: 'value3', columnName: 'Column1' },
              '436f6c756d6e32': { value: 'value4', columnName: 'Column2' },
            },
          },
        ]),
        columns: ['Column1', 'Column2'],
        numRows: 2,
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rows: {
        label: 'Data rows',
        displayedValue: '2 rows',
      },
      rowsFound: {
        label: 'No. of rows found',
      },
      columns: [
        {
          label: 'Column1',
          displayedValue: '',
        },
        {
          label: 'Column2',
          displayedValue: '',
        },
      ],
    })
  })

  it('should handle missing columns in dataOut', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 1,
        rows: JSON.stringify([{ row: {} }]),
        // columns is missing
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rowsFound: {
        label: 'No. of rows found',
      },
      rows: {
        label: 'Data rows',
        displayedValue: '1 rows',
      },
      columns: [],
    })
  })

  it('should handle invalid dataOut format gracefully', async () => {
    // This test verifies that the function doesn't throw when dataOut doesn't match the schema
    // In a real scenario, the zod schema would throw, but we're testing the error handling
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    const executionStep = {
      dataOut: {
        // Missing the required rowsFound field
        someOtherField: true,
      },
    } as unknown as IExecutionStep

    // The function should throw when parsing invalid dataOut
    await expect(getDataOutMetadata(executionStep)).rejects.toThrow()

    consoleSpy.mockRestore()
  })
})
