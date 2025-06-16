import { describe, expect, it } from 'vitest'

import getDataOutMetadata from '../../../actions/for-each/get-data-out-metadata'
import { FOR_EACH_INPUT_SOURCE } from '../../../common/constants'

describe('getDataOutMetadata', () => {
  const createMockExecutionStep = (dataOut: any) => ({
    id: 'execution-step-id',
    executionId: 'execution-id',
    stepId: 'step-id',
    step: {} as any,
    dataIn: {},
    dataOut,
    errorDetails: {},
    status: 'success' as const,
    appKey: 'toolbox',
    key: 'forEach',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    metadata: {},
  })

  describe('when dataOut is null or undefined', () => {
    it('should return null when dataOut is null', async () => {
      const executionStep = createMockExecutionStep(null)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toBeNull()
    })

    it('should return null when dataOut is undefined', async () => {
      const executionStep = createMockExecutionStep(undefined)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toBeNull()
    })
  })

  describe('when inputSource is CHECKBOX', () => {
    it('should return metadata for checkbox input with single item', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        items: ['Item 1'],
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          isHidden: true,
        },
        item: {
          label: 'Item',
          type: 'text',
          displayedValue: 'Item 1',
        },
      })
    })

    it('should return metadata for checkbox input with multiple items', async () => {
      const dataOut = {
        iterations: 3,
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        items: ['Apple', 'Banana', 'Cherry'],
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          isHidden: true,
        },
        item: {
          label: 'Item',
          type: 'text',
          displayedValue: 'Apple',
        },
      })
    })

    it('should return metadata for checkbox input with empty string as first item', async () => {
      const dataOut = {
        iterations: 2,
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        items: ['', 'Non-empty item'],
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          isHidden: true,
        },
        item: {
          label: 'Item',
          type: 'text',
          displayedValue: '',
        },
      })
    })

    it('should handle when checkbox is empty', async () => {
      const dataOut = {
        iterations: 0,
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        items: [] as any[],
      }

      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          isHidden: true,
        },
        item: {
          label: 'Item',
          type: 'text',
          displayedValue: '',
        },
      })
    })
  })

  describe('when inputSource is M365_EXCEL', () => {
    it('should return metadata for M365 Excel input with basic columns', async () => {
      const dataOut = {
        iterations: 2,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        items: {
          columns: [
            {
              id: 'name',
              name: 'Full Name',
              value: 'items.rows.__ITERATION__.data.name',
            },
            {
              id: 'email',
              name: 'Email Address',
              value: 'items.rows.__ITERATION__.data.email',
            },
          ],
          rows: [
            { data: { name: 'John Doe', email: 'john@example.com' } },
            { data: { name: 'Jane Smith', email: 'jane@example.com' } },
          ],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Full Name',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Email Address',
                displayedValue: ' ',
                order: 3,
                type: 'text',
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })

    it('should return metadata for M365 Excel input with empty rows', async () => {
      const dataOut = {
        iterations: 0,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        items: {
          columns: [
            {
              id: 'col1',
              name: 'Column 1',
              value: 'items.rows.__ITERATION__.data.col1',
            },
          ],
          rows: [] as any[],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Column 1',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
          ],
          rows: [],
        },
      })
    })

    it('should return metadata for M365 Excel input with single row', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        items: {
          columns: [
            {
              id: 'task',
              name: 'Task Name',
              value: 'items.rows.__ITERATION__.data.task',
            },
          ],
          rows: [{ data: { task: 'Complete project' } }],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Task Name',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })
  })

  describe('when inputSource is TILES', () => {
    it('should return metadata for Tiles input with basic columns', async () => {
      const dataOut = {
        iterations: 2,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        items: {
          columns: [
            {
              id: 'title',
              name: 'Title',
              value: 'items.rows.__ITERATION__.data.title',
            },
            {
              id: 'status',
              name: 'Status',
              value: 'items.rows.__ITERATION__.data.status',
            },
          ],
          rows: [
            {
              data: { title: 'Task 1', status: 'In Progress' },
              rowId: 'row-1',
            },
            { data: { title: 'Task 2', status: 'Completed' }, rowId: 'row-2' },
          ],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Title',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Status',
                displayedValue: ' ',
                order: 3,
                type: 'text',
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })

    it('should return metadata for Tiles input with rowId column', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        items: {
          columns: [
            {
              id: 'name',
              name: 'Name',
              value: 'items.rows.__ITERATION__.data.name',
            },
            {
              id: 'rowId',
              name: 'Row ID',
              value: 'items.rows.__ITERATION__.rowId',
            },
          ],
          rows: [{ data: { name: 'Test Item' }, rowId: 'tile-row-123' }],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Name',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Row ID',
                displayedValue: ' ',
                order: 3,
                type: 'tile_row_id', // Special type for rowId
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })

    it('should handle mixed columns with and without rowId correctly', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        items: {
          columns: [
            {
              id: 'priority',
              name: 'Priority',
              value: 'items.rows.__ITERATION__.data.priority',
            },
            {
              id: 'rowId',
              name: 'Row ID',
              value: 'items.rows.__ITERATION__.rowId',
            },
            {
              id: 'description',
              name: 'Description',
              value: 'items.rows.__ITERATION__.data.description',
            },
          ],
          rows: [
            {
              data: { priority: 'High', description: 'Important task' },
              rowId: 'tile-456',
            },
          ],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Priority',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Row ID',
                displayedValue: ' ',
                order: 3,
                type: 'tile_row_id',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Description',
                displayedValue: ' ',
                order: 4,
                type: 'text',
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })
  })

  describe('when inputSource is unrecognized', () => {
    it('should throw an error for unknown input source', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: 'unknown-source',
        items: ['some', 'data'],
      }
      const executionStep = createMockExecutionStep(dataOut)

      await expect(getDataOutMetadata(executionStep)).resolves.toBeNull()
    })

    it('should throw an error when inputSource is null', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: null as any,
        items: ['some', 'data'],
      }
      const executionStep = createMockExecutionStep(dataOut)
      await expect(getDataOutMetadata(executionStep)).resolves.toBeNull()
    })
  })

  describe('schema validation edge cases', () => {
    it('should handle dataOut that fails schema validation', async () => {
      const dataOut = {
        // missing required fields
        invalidField: 'invalid',
      }
      const executionStep = createMockExecutionStep(dataOut)

      // This should throw because dataOutSchema.parse will fail
      await expect(getDataOutMetadata(executionStep)).resolves.toBeNull()
    })

    it('should handle dataOut with missing iterations field', async () => {
      const dataOut = {
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        items: ['test'],
        // missing iterations field
      }
      const executionStep = createMockExecutionStep(dataOut)

      await expect(getDataOutMetadata(executionStep)).resolves.toBeNull()
    })

    it('should handle dataOut with missing items field', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
        // missing items field
      }
      const executionStep = createMockExecutionStep(dataOut)

      await expect(getDataOutMetadata(executionStep)).resolves.toBeNull()
    })
  })

  describe('column ordering', () => {
    it('should assign correct order values to columns based on index', async () => {
      const dataOut = {
        iterations: 1,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        items: {
          columns: [
            {
              id: 'first',
              name: 'First Column',
              value: 'items.rows.__ITERATION__.data.first',
            },
            {
              id: 'second',
              name: 'Second Column',
              value: 'items.rows.__ITERATION__.data.second',
            },
            {
              id: 'third',
              name: 'Third Column',
              value: 'items.rows.__ITERATION__.data.third',
            },
          ],
          rows: [{ data: { first: 'A', second: 'B', third: 'C' } }],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result?.items?.columns).toHaveLength(3)
      expect(result?.items?.columns?.[0]?.value?.order).toBe(2)
      expect(result?.items?.columns?.[1]?.value?.order).toBe(3)
      expect(result?.items?.columns?.[2]?.value?.order).toBe(4)
    })
  })

  describe('different data types in rows', () => {
    it('should handle rows with mixed data types', async () => {
      const dataOut = {
        iterations: 2,
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        items: {
          columns: [
            {
              id: 'number',
              name: 'Number',
              value: 'items.rows.__ITERATION__.data.number',
            },
            {
              id: 'text',
              name: 'Text',
              value: 'items.rows.__ITERATION__.data.text',
            },
          ],
          rows: [
            { data: { number: 42, text: 'Hello' } },
            { data: { number: 3.14, text: 'World' } },
          ],
        },
      }
      const executionStep = createMockExecutionStep(dataOut)

      const result = await getDataOutMetadata(executionStep)

      expect(result).toEqual({
        iterations: {
          label: 'Number of items',
          order: 1,
        },
        inputSource: {
          isHidden: true,
        },
        items: {
          columns: [
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Number',
                displayedValue: ' ',
                order: 2,
                type: 'text',
              },
            },
            {
              id: { isHidden: true },
              name: { isHidden: true },
              value: {
                label: 'Text',
                displayedValue: ' ',
                order: 3,
                type: 'text',
              },
            },
          ],
          rows: [
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
            {
              rowId: { isHidden: true },
              data: { isHidden: true },
            },
          ],
        },
      })
    })
  })
})
