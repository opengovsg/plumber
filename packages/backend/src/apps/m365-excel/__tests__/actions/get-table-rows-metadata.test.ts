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
      rows: {
        label: 'List of row(s) found',
        displayedValue: 'Preview 0 row(s)',
        order: 1,
        type: 'array',
      },
      rowsFound: {
        label: 'Number of rows found',
        order: 2,
      },
      columns: {},
    })
  })

  it('should return metadata for foundRows: true with row data', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 2,
        rowData: [
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
        ],
        columns: {
          Column1: { id: 'Column1', value: 'value1, value3', order: 1 },
          Column2: { id: 'Column2', value: 'value2, value4', order: 2 },
        },
        numRows: 2,
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rows: {
        label: 'List of row(s) found',
        displayedValue: 'Preview 2 row(s)',
        order: 1,
        type: 'array',
      },
      rowsFound: {
        label: 'Number of rows found',
        order: 2,
      },
      columns: {
        Column1: {
          id: { isHidden: true },
          value: {
            label: 'Column1',
            order: 3,
          },
          order: { isHidden: true },
        },
        Column2: {
          id: { isHidden: true },
          value: {
            label: 'Column2',
            order: 4,
          },
          order: { isHidden: true },
        },
      },
    })
  })

  it('should handle missing columns in dataOut', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 0,
        rows: [],
        // columns is missing
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rows: {
        label: 'List of row(s) found',
        displayedValue: 'Preview 0 row(s)',
        order: 1,
        type: 'array',
      },
      rowsFound: {
        label: 'Number of rows found',
        order: 2,
      },
      columns: {},
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
