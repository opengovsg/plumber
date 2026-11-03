import { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isCheckboxItems,
  ProcessedColumn,
  processItems,
} from '@/apps/toolbox/common/get-for-each-variables'
import StepError from '@/errors/step'

import action from '../../../actions/for-each'
import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
} from '../../../common/constants'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

vi.mock('@/apps/toolbox/common/get-for-each-variables', () => ({
  isCheckboxItems: vi.fn(),
  processItems: vi.fn(),
}))

const mockedIsCheckboxItems = vi.mocked(isCheckboxItems)
const mockedProcessItems = vi.mocked(processItems)

const MOCK_FLOW = [
  {
    id: 'trigger',
    appKey: 'formsg',
    key: 'newSubmission',
    position: 1,
  },
  {
    id: 'test-step',
    appKey: 'tiles',
    key: 'findMultipleRows',
    position: 2,
  },
  {
    id: 'for-each',
    appKey: 'toolbox',
    key: action.key,
    position: 3,
  },
  {
    id: 'for-each-action',
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    position: 4,
  },
]

const VALID_TABLE_DATA = {
  rows: [
    {
      data: {
        col1: 'value1',
        col2: 'value2',
      },
      rowId: 'row-1',
    },
    {
      data: {
        col1: 'value3',
        col2: 'value4',
      },
      rowId: 'row-2',
    },
  ],
  columns: [
    {
      id: 'col1',
      name: 'Column 1',
      value: 'col1-value',
    },
    {
      id: 'col2',
      name: 'Column 2',
      value: 'col2-value',
    },
  ],
  inputSource: FOR_EACH_INPUT_SOURCE.TILES,
}

describe('For each action', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.clearAllMocks()

    $ = {
      flow: {
        id: 'fake-pipe',
        steps: MOCK_FLOW,
      },
      step: {
        id: 'for-each',
        appKey: 'toolbox',
        key: action.key,
        position: 3,
        parameters: {},
      },
      app: {
        name: 'Toolbox',
      },
      execution: {
        testRun: false,
      },
      getLastExecutionStep: vi.fn(),
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('checkbox input', () => {
    it('should handle valid checkbox input', async () => {
      const checkboxItems = ['item1', 'item2', 'item3']
      $.step.parameters.items = ['item1', 'item2', 'item3']

      mockedIsCheckboxItems.mockReturnValue(true)

      const result = await action.run($)

      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 3,
          items: checkboxItems,
          inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
          item: `items.${FOR_EACH_ITERATION_KEY}`,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle checkbox input with whitespace', async () => {
      const checkboxItems = ['   item1', 'item2', 'item3']
      $.step.parameters.items = ['   item1', 'item2', 'item3']

      mockedIsCheckboxItems.mockReturnValue(true)

      await action.run($)

      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 3,
          items: checkboxItems,
          inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
          item: `items.${FOR_EACH_ITERATION_KEY}`,
        },
      })
    })

    it('should handle single checkbox item', async () => {
      const checkboxItems = ['single-item']
      $.step.parameters.items = ['single-item']

      mockedIsCheckboxItems.mockReturnValue(true)

      const result = await action.run($)

      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 1,
          items: checkboxItems,
          inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
          item: `items.${FOR_EACH_ITERATION_KEY}`,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should throw error when checkbox items validation fails', async () => {
      $.step.parameters.items = 'item1,item2,item3'

      await expect(action.run($)).rejects.toThrow(StepError)
      await expect(action.run($)).rejects.toThrow('Invalid input list')
      await expect(action.run($)).rejects.toMatchObject({ kind: 'config' })
    })
  })

  describe('table input - backward compatibility with the old dataOut format', () => {
    const validTableData = {
      rows: [
        {
          data: {
            col1: 'value1',
            col2: 'value2',
          },
          rowId: 'row-1',
        },
        {
          data: {
            col1: 'value3',
            col2: 'value4',
          },
          rowId: 'row-2',
        },
      ],
      columns: [
        {
          id: 'col1',
          name: 'Column 1',
          value: 'col1-value',
        },
        {
          id: 'col2',
          name: 'Column 2',
          value: 'col2-value',
        },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.TILES,
    }

    const DATA_OUT = {
      dataOut: {
        items: validTableData,
      },
    }

    it('should handle valid table input (Tiles)', async () => {
      $.step.parameters.items = validTableData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: validTableData.rows,
        columns: validTableData.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(validTableData)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        },
      })
      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle valid table input (M365 Excel)', async () => {
      const excelData = {
        ...validTableData,
        rows: validTableData.rows.map((row) => ({ data: row.data })), // No rowId for Excel
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      $.step.parameters.items = excelData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: excelData.rows,
        columns: validTableData.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(excelData)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle valid table input (FormSG Table field)', async () => {
      const mockTableFieldData = JSON.stringify(VALID_TABLE_DATA)
      $.step.parameters.items = mockTableFieldData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: VALID_TABLE_DATA.rows,
        columns: VALID_TABLE_DATA.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
      }

      mockedProcessItems.mockReturnValue(processedResult)
      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(VALID_TABLE_DATA)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
        },
      })
      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle FormSG Table field with no row data', async () => {
      const mockTableFieldData = {
        rows: [] as any[],
        columns: VALID_TABLE_DATA.columns,
      }
      const stringifiedTableFieldData = JSON.stringify(mockTableFieldData)

      $.step.parameters.items = stringifiedTableFieldData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        dataOut: {
          items: mockTableFieldData,
        },
      })
      const processedResult = {
        rows: [] as any[],
        columns: VALID_TABLE_DATA.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
      }
      mockedProcessItems.mockReturnValue(processedResult)
      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(mockTableFieldData)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 0,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'stop-execution',
          stepId: 'for-each',
        },
      })
    })

    it('should handle table input with empty rows', async () => {
      const emptyTableData = {
        rows: [] as any[],
        columns: validTableData.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      $.step.parameters.items = emptyTableData

      const processedResult = {
        rows: [] as any[],
        columns: validTableData.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 0,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'stop-execution',
          stepId: 'for-each',
        },
      })
    })
  })

  describe('table input - new dataOut format', () => {
    const newColumns = {} as Record<string, ProcessedColumn>
    VALID_TABLE_DATA.columns.forEach((column, index) => {
      newColumns[column.id] = {
        ...column,
        value: `data.columns.${column.id}`,
        order: index + 1,
      }
    })

    const DATA_OUT = {
      dataOut: {
        items: {
          ...VALID_TABLE_DATA,
          columns: newColumns,
        },
      },
    }

    it('should handle valid table input (Tiles)', async () => {
      $.step.parameters.items = VALID_TABLE_DATA
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: VALID_TABLE_DATA.rows,
        columns: newColumns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(VALID_TABLE_DATA)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        },
      })
      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle valid table input (M365 Excel)', async () => {
      const excelData = {
        ...VALID_TABLE_DATA,
        rows: VALID_TABLE_DATA.rows.map((row) => ({ data: row.data })), // No rowId for Excel
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      $.step.parameters.items = excelData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: excelData.rows,
        columns: newColumns,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(excelData)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle table input with empty rows', async () => {
      const emptyTableData = {
        rows: [] as any[],
        columns: VALID_TABLE_DATA.columns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      $.step.parameters.items = emptyTableData

      const processedResult = {
        rows: [] as any[],
        columns: newColumns,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      mockedProcessItems.mockReturnValue(processedResult)

      const result = await action.run($)

      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 0,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'stop-execution',
          stepId: 'for-each',
        },
      })
    })

    it('should handle valid table input (FormSG Table field)', async () => {
      const mockTableFieldData = JSON.stringify(VALID_TABLE_DATA)
      $.step.parameters.items = mockTableFieldData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)

      const processedResult = {
        rows: VALID_TABLE_DATA.rows,
        columns: newColumns,
        inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
      }

      mockedProcessItems.mockReturnValue(processedResult)
      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(VALID_TABLE_DATA)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 2,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
        },
      })
      expect(result).toEqual({
        nextStep: {
          command: 'start-for-each',
          stepId: 'for-each',
        },
      })
    })

    it('should handle FormSG Table field with no row data', async () => {
      const mockTableFieldData = {
        rows: [] as any[],
        columns: VALID_TABLE_DATA.columns,
      }
      const stringifiedTableFieldData = JSON.stringify(mockTableFieldData)

      $.step.parameters.items = stringifiedTableFieldData
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce(DATA_OUT)
      const processedResult = {
        rows: [] as any[],
        columns: newColumns,
        inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
      }
      mockedProcessItems.mockReturnValue(processedResult)
      const result = await action.run($)

      expect(mockedProcessItems).toHaveBeenCalledWith(mockTableFieldData)
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: {
          iteration: FOR_EACH_ITERATION_KEY,
          iterations: 0,
          items: processedResult,
          inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
        },
      })

      expect(result).toEqual({
        nextStep: {
          command: 'stop-execution',
          stepId: 'for-each',
        },
      })
    })
  })

  describe('error handling', () => {
    it.each([
      { description: 'empty', items: '' },
      { description: 'whitespace-only', items: '   ' },
      { description: 'invalid JSON', items: '{ invalid json' },
      { description: 'missing', items: undefined },
      { description: 'null', items: null },
      {
        description: 'JSON missing required fields',
        items: JSON.stringify({ invalidField: 'value' }),
      },
      {
        description: 'table failing the table schema',
        items: { ...VALID_TABLE_DATA, columns: 'not-a-column-list' },
      },
    ])(
      'should throw a config StepError for $description input',
      async ({ items }) => {
        $.step.parameters.items = items

        await expect(action.run($)).rejects.toThrow(StepError)
        await expect(action.run($)).rejects.toThrow('Invalid input list')
        await expect(action.run($)).rejects.toMatchObject({ kind: 'config' })
      },
    )

    it('should throw a config StepError for an empty list in a test run', async () => {
      $.execution.testRun = true
      $.step.parameters.items = []

      await expect(action.run($)).rejects.toMatchObject({ kind: 'config' })
    })

    it('should throw a config StepError when processing valid input fails', async () => {
      $.step.parameters.items = VALID_TABLE_DATA
      mockedProcessItems.mockImplementationOnce(() => {
        throw new TypeError('columns is not iterable')
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(action.run($)).rejects.toMatchObject({
        kind: 'config',
        message: expect.stringContaining('Invalid input list'),
      })
    })
  })
})
