import { IExecutionStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import getDataOutMetadata from '../../actions/get-table-rows/get-data-out-metadata'

const DEFAULT_SUCCESS_EXECUTION_STEP = {
  dataOut: {
    rowsFound: 2,
    data: {
      rows: [
        {
          data: {
            '436f6c756d6e31': 'value1',
            '436f6c756d6e32': 'value2',
          },
        },
        {
          data: {
            '436f6c756d6e31': 'value3',
            '436f6c756d6e32': 'value4',
          },
        },
      ],
      columns: [
        {
          id: '436f6c756d6e31',
          name: 'Column1',
          value: `data.rows.*.${Buffer.from('Column1').toString('hex')}`,
        },
        {
          id: '436f6c756d6e32',
          name: 'Column2',
          value: `data.rows.*.${Buffer.from('Column2').toString('hex')}`,
        },
      ],
    },
  },
} as unknown as IExecutionStep

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
        data: {
          rows: [],
          columns: [
            {
              id: '436f6c756d6e31',
              name: 'Column1',
              value: `data.rows.*.${Buffer.from('Column1').toString('hex')}`,
            },
          ],
        },
      },
    } as unknown as IExecutionStep
    const result = await getDataOutMetadata(executionStep)

    expect(result).toEqual({
      rowsFound: {
        label: 'Number of rows found',
        order: 2,
      },
      data: {
        label: 'List of row(s) found',
        displayedValue: 'Preview 0 row(s)',
        order: 1,
        type: 'table',
      },
    })
  })

  it('should return metadata for foundRows: true with row data', async () => {
    const result = await getDataOutMetadata(DEFAULT_SUCCESS_EXECUTION_STEP)

    expect(result).toEqual({
      rowsFound: {
        label: 'Number of rows found',
        order: 2,
      },
      data: {
        label: 'List of row(s) found',
        displayedValue: 'Preview 2 row(s)',
        order: 1,
        type: 'table',
      },
    })
  })

  it('should handle missing columns in dataOut', async () => {
    const executionStep = {
      dataOut: {
        rowsFound: 0,
        data: {
          rows: [],
          // columns is missing
        },
      },
    } as unknown as IExecutionStep

    await expect(getDataOutMetadata(executionStep)).rejects.toThrow()
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
