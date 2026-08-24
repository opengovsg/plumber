import { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import StepError from '@/errors/step'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Context from '@/types/express/context'

import m365Excel from '../..'
import getTableRowsAction from '../../actions/get-table-rows'
import { stepTransformer } from '../../common/transform-step-parameters'
import { HexEncodedRowObject } from '../../common/workbook-helpers/tables/convert-row-to-hex-encoded-row-record'

const DEFAULT_PARAMETERS = {
  fileId: 'test-file-id',
  tableId: '{test-table-id}',
  lookupColumn: 'Column1',
  lookupValue: 'test-value',
}

const { transformStepParameters } = stepTransformer

const getHexEncodedColumnName = (columnName: string) =>
  Buffer.from(columnName).toString('hex')

const getColumnObject = (columnName: string) => ({
  id: getHexEncodedColumnName(columnName),
  name: columnName,
  value: `data.rows.*.data.${getHexEncodedColumnName(columnName)}`,
})

// Mock dependencies
const mocks = vi.hoisted(() => ({
  WorkbookSession: {
    acquire: vi.fn(),
    request: vi.fn(),
  },
  getTopNTableRows: vi.fn(),
  convertRowToHexKeyedObject: vi.fn(),
}))

vi.mock('../../common/workbook-session', () => ({
  default: {
    acquire: mocks.WorkbookSession.acquire,
  },
}))

vi.mock('../../common/get-top-n-table-rows', () => ({
  default: mocks.getTopNTableRows,
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
        parameters: DEFAULT_PARAMETERS,
        version: 1,
      },
      app: {
        name: m365Excel.name,
      },
      setActionItem: vi.fn(),
      http: {
        request: vi.fn(),
      },
    } as unknown as IGlobalVariable

    // Simulate the Step model's afterFind hook, which transforms parameters
    // before they reach the action's run function in real execution.
    $.step.parameters = transformStepParameters(
      $.step.key,
      $.step.parameters,
      $.step.version,
    )

    // Setup default mock implementations
    mocks.getTopNTableRows.mockResolvedValue({
      columns: ['Column1', 'Column2', 'Column3', 'Column4'],
      rows: [
        ['non-matching', 'data1', 'a', '1'],
        ['test-value', 'data2', 'b', '2'],
        ['test-value', 'data3', 'a', '3'],
        ['', 'data4', 'a', '3'],
        ['row5', '', 'b', '2'],
        ['', 'data6', 'c', '1'],
      ],
      headerSheetRowIndex: 0,
    })

    // Setup hex-encoded row record mock
    mocks.convertRowToHexKeyedObject.mockImplementation(
      ({ row, columns }: { row: string[]; columns: string[] }) => {
        // Create a simple mock implementation that converts the row to a record
        const result: HexEncodedRowObject = Object.create(null)

        for (const [cellIndex, cell] of row.entries()) {
          const cellColumnName = columns[cellIndex]
          const hexEncodedColumnName =
            Buffer.from(cellColumnName).toString('hex')

          result[hexEncodedColumnName] = cell
        }

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

    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        data: {
          columns: [getColumnObject('Column1'), getColumnObject('Column2')],
          rows: [],
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
        rowsFound: 0,
      },
    })
  })

  it('should return matching rows when found', async () => {
    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        rowsFound: 2, // Two rows match 'test-value'
        data: {
          columns: [
            getColumnObject('Column1'),
            getColumnObject('Column2'),
            getColumnObject('Column3'),
            getColumnObject('Column4'),
          ],
          rows: [
            {
              data: {
                [getHexEncodedColumnName('Column1')]: 'test-value',
                [getHexEncodedColumnName('Column2')]: 'data2',
                [getHexEncodedColumnName('Column3')]: 'b',
                [getHexEncodedColumnName('Column4')]: '2',
              },
            },
            {
              data: {
                [getHexEncodedColumnName('Column1')]: 'test-value',
                [getHexEncodedColumnName('Column2')]: 'data3',
                [getHexEncodedColumnName('Column3')]: 'a',
                [getHexEncodedColumnName('Column4')]: '3',
              },
            },
          ],
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      },
    })

    // Verify the rowData contains the expected rows
    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const rowData = call.raw.data.rows

    expect(rowData).toHaveLength(2)
    expect(rowData[0].data[getHexEncodedColumnName('Column1')]).toBe(
      'test-value',
    )
    expect(rowData[0].data[getHexEncodedColumnName('Column2')]).toBe('data2')
    expect(rowData[1].data[getHexEncodedColumnName('Column1')]).toBe(
      'test-value',
    )
    expect(rowData[1].data[getHexEncodedColumnName('Column2')]).toBe('data3')
  })

  it('should return matching rows when lookup value is empty', async () => {
    $.step.parameters = { ...DEFAULT_PARAMETERS, lookupValue: '' }
    $.step.parameters = transformStepParameters(
      $.step.key,
      $.step.parameters,
      $.step.version,
    )
    await getTableRowsAction.run($)

    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        rowsFound: 2,
        data: {
          columns: [
            getColumnObject('Column1'),
            getColumnObject('Column2'),
            getColumnObject('Column3'),
            getColumnObject('Column4'),
          ],
          rows: [
            {
              data: {
                [getHexEncodedColumnName('Column1')]: '',
                [getHexEncodedColumnName('Column2')]: 'data4',
                [getHexEncodedColumnName('Column3')]: 'a',
                [getHexEncodedColumnName('Column4')]: '3',
              },
            },
            {
              data: {
                [getHexEncodedColumnName('Column1')]: '',
                [getHexEncodedColumnName('Column2')]: 'data6',
                [getHexEncodedColumnName('Column3')]: 'c',
                [getHexEncodedColumnName('Column4')]: '1',
              },
            },
          ],
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      },
    })

    // Verify the rowData contains the expected rows
    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const rowData = call.raw.data.rows

    expect(rowData).toHaveLength(2)
    expect(rowData[0].data[getHexEncodedColumnName('Column1')]).toBe('')
    expect(rowData[0].data[getHexEncodedColumnName('Column2')]).toBe('data4')
    expect(rowData[1].data[getHexEncodedColumnName('Column1')]).toBe('')
    expect(rowData[1].data[getHexEncodedColumnName('Column2')]).toBe('data6')
  })

  it('should handle invalid parameters', async () => {
    $.step.parameters.fileId = ''
    await expect(getTableRowsAction.run($)).rejects.toThrow(StepError)

    $.step.parameters.tableId = '!!!'
    await expect(getTableRowsAction.run($)).rejects.toThrow(StepError)
  })

  it('should handle case-sensitive matching', async () => {
    // Change the lookup value to be different case
    $.step.parameters = { ...DEFAULT_PARAMETERS, lookupValue: 'TEST-VALUE' }
    $.step.parameters = transformStepParameters(
      $.step.key,
      $.step.parameters,
      $.step.version,
    )

    await getTableRowsAction.run($)

    // Should not find any matches due to case sensitivity
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        data: {
          columns: [
            getColumnObject('Column1'),
            getColumnObject('Column2'),
            getColumnObject('Column3'),
            getColumnObject('Column4'),
          ],
          rows: [],
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },

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
    $.step.parameters = { ...DEFAULT_PARAMETERS, lookupValue: 'TEST-VALUE' }
    $.step.parameters = transformStepParameters(
      $.step.key,
      $.step.parameters,
      $.step.version,
    )

    await getTableRowsAction.run($)

    // Should find the exact case match
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        rowsFound: 1,
        data: {
          rows: [
            {
              data: {
                [getHexEncodedColumnName('Column1')]: 'TEST-VALUE',
                [getHexEncodedColumnName('Column2')]: 'data2',
              },
            },
          ],
          columns: [getColumnObject('Column1'), getColumnObject('Column2')],
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      },
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
        data: {
          columns: [getColumnObject('Column1'), getColumnObject('Column2')],
          rows: expect.arrayContaining(
            Array.from({ length: 500 }, (_, i) =>
              expect.objectContaining({
                data: {
                  [getHexEncodedColumnName('Column1')]: 'test-value',
                  [getHexEncodedColumnName('Column2')]: `data${i + 1}`,
                },
              }),
            ),
          ),
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      }),
    })

    // Verify the rowData contains exactly 500 rows
    const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const rowData = call.raw.data.rows
    expect(rowData).toHaveLength(500)

    // Verify the first and last rows are correct
    expect(rowData[0].data[getHexEncodedColumnName('Column1')]).toBe(
      'test-value',
    )
    expect(rowData[0].data[getHexEncodedColumnName('Column2')]).toBe('data1')
    expect(rowData[499].data[getHexEncodedColumnName('Column1')]).toBe(
      'test-value',
    )
    expect(rowData[499].data[getHexEncodedColumnName('Column2')]).toBe(
      'data500',
    )
  })

  describe('multiple filters', () => {
    it('should find rows matching all filters', async () => {
      $.step.parameters.filters = [
        { lookupColumn: 'Column3', lookupValue: 'a' },
        { lookupColumn: 'Column4', lookupValue: '3' },
      ]

      await getTableRowsAction.run($)

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          rowsFound: 2,
          data: {
            columns: [
              getColumnObject('Column1'),
              getColumnObject('Column2'),
              getColumnObject('Column3'),
              getColumnObject('Column4'),
            ],
            rows: [
              {
                data: {
                  [getHexEncodedColumnName('Column1')]: 'test-value',
                  [getHexEncodedColumnName('Column2')]: 'data3',
                  [getHexEncodedColumnName('Column3')]: 'a',
                  [getHexEncodedColumnName('Column4')]: '3',
                },
              },
              {
                data: {
                  [getHexEncodedColumnName('Column1')]: '',
                  [getHexEncodedColumnName('Column2')]: 'data4',
                  [getHexEncodedColumnName('Column3')]: 'a',
                  [getHexEncodedColumnName('Column4')]: '3',
                },
              },
            ],
            inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
          },
        },
      })

      const call = ($.setActionItem as ReturnType<typeof vi.fn>).mock
        .calls[0][0]
      const rowData = call.raw.data.rows
      expect(rowData).toHaveLength(2)
    })

    it('should return no rows when only some filters match', async () => {
      $.step.parameters.filters = [
        { lookupColumn: 'Column1', lookupValue: 'test-value' },
        { lookupColumn: 'Column2', lookupValue: 'non-matching' },
      ]

      await getTableRowsAction.run($)

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          data: {
            columns: [
              getColumnObject('Column1'),
              getColumnObject('Column2'),
              getColumnObject('Column3'),
              getColumnObject('Column4'),
            ],
            rows: [],
            inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
          },
          rowsFound: 0,
        },
      })
    })

    it('should handle empty string in multiple filters', async () => {
      $.step.parameters.filters = [
        { lookupColumn: 'Column1', lookupValue: '' },
        { lookupColumn: 'Column2', lookupValue: 'data4' },
      ]

      await getTableRowsAction.run($)

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          rowsFound: 1,
          data: {
            columns: [
              getColumnObject('Column1'),
              getColumnObject('Column2'),
              getColumnObject('Column3'),
              getColumnObject('Column4'),
            ],
            rows: [
              {
                data: {
                  [getHexEncodedColumnName('Column1')]: '',
                  [getHexEncodedColumnName('Column2')]: 'data4',
                  [getHexEncodedColumnName('Column3')]: 'a',
                  [getHexEncodedColumnName('Column4')]: '3',
                },
              },
            ],
            inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
          },
        },
      })
    })
  })
})
