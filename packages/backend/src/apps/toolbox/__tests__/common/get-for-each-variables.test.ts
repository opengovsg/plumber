import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
} from '@/apps/toolbox/common/constants'
import {
  isCheckboxItems,
  processItems,
} from '@/apps/toolbox/common/get-for-each-variables'

describe('get-for-each-variables', () => {
  describe('isCheckboxItems', () => {
    it('should return true for array of strings', () => {
      const items = ['item1', 'item2', 'item3']
      expect(isCheckboxItems(items)).toBe(true)
    })

    it('should return true for empty array', () => {
      const items: string[] = []
      expect(isCheckboxItems(items)).toBe(true)
    })

    it('should return true for single string item', () => {
      const items = ['single-item']
      expect(isCheckboxItems(items)).toBe(true)
    })

    it('should return false for array containing non-string items', () => {
      const items = ['item1', 123, 'item3'] as any
      expect(isCheckboxItems(items)).toBe(false)
    })

    it('should return false for array containing objects', () => {
      const items = ['item1', { key: 'value' }, 'item3'] as any
      expect(isCheckboxItems(items)).toBe(false)
    })

    it('should return false for array containing null', () => {
      const items = ['item1', null, 'item3'] as any
      expect(isCheckboxItems(items)).toBe(false)
    })

    it('should return false for array containing undefined', () => {
      const items = ['item1', undefined, 'item3'] as any
      expect(isCheckboxItems(items)).toBe(false)
    })

    it('should return false for non-array input', () => {
      expect(isCheckboxItems('not-an-array' as any)).toBe(false)
      expect(isCheckboxItems(null as any)).toBe(false)
      expect(isCheckboxItems(undefined as any)).toBe(false)
      expect(isCheckboxItems({} as any)).toBe(false)
    })
  })

  describe('processItems - backward compatibility with the old dataOut format', () => {
    it('should process tiles data (with UUID column IDs)', () => {
      const col1Id = randomUUID()
      const col2Id = randomUUID()
      const mockData = {
        rows: [
          {
            data: {
              [col1Id]: 'Value 1',
              [col2Id]: 'Value 2',
            },
            rowId: randomUUID(),
          },
          {
            data: {
              [col1Id]: 3,
              [col2Id]: 4,
            },
            rowId: randomUUID(),
          },
        ],
        columns: [
          { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
          { id: col2Id, name: 'Column 2', value: `data.rows.*.data.${col2Id}` },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
      expect(result.rows).toEqual(mockData.rows)
      expect(result.columns).toEqual([
        {
          id: col1Id,
          name: 'Column 1',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
          order: 1,
        },
        {
          id: col2Id,
          name: 'Column 2',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col2Id}`,
          order: 2,
        },
        {
          id: 'rowId',
          name: 'Row ID',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
          order: 3,
        },
      ])
    })

    it('should process tiles data (with ULID column IDs)', () => {
      // ULID format: 26 characters, base32 encoded
      const col1Id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
      const col2Id = '01BX5ZZKBKACTAV9WEVGEMMVS0'
      const mockData = {
        rows: [
          {
            data: {
              [col1Id]: 'Value 1',
              [col2Id]: 'Value 2',
            },
            rowId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          },
        ],
        columns: [
          { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
          { id: col2Id, name: 'Column 2', value: `data.rows.*.data.${col2Id}` },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
      expect(result.rows).toEqual(mockData.rows)
      expect(result.columns).toEqual([
        {
          id: col1Id,
          name: 'Column 1',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
          order: 1,
        },
        {
          id: col2Id,
          name: 'Column 2',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col2Id}`,
          order: 2,
        },
        {
          id: 'rowId',
          name: 'Row ID',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
          order: 3,
        },
      ])
    })

    it('should process m365-excel data (with regular column IDs)', () => {
      const mockData = {
        rows: [
          {
            data: {
              col1: 1,
              col2: 2,
            },
          },
          {
            data: {
              col1: 'Excel Value 3',
              col2: 'Excel Value 4',
            },
          },
        ],
        columns: [
          {
            id: 'col1',
            name: 'Excel Column 1',
            value: `data.rows.*.data.col1`,
          },
          {
            id: 'col2',
            name: 'Excel Column 2',
            value: `data.rows.*.data.col2`,
          },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
      expect(result.rows).toEqual(mockData.rows)
      expect(result.columns).toEqual([
        {
          id: 'col1',
          name: 'Excel Column 1',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col1`,
          order: 1,
        },
        {
          id: 'col2',
          name: 'Excel Column 2',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col2`,
          order: 2,
        },
      ])
    })

    it('should handle empty tiles rows', () => {
      const col1Id = randomUUID()
      const mockData = {
        rows: [] as any[],
        columns: [
          { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
      expect(result.rows).toEqual([])
      expect(result.columns).toEqual([
        {
          id: col1Id,
          name: 'Column 1',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
          order: 1,
        },
        {
          id: 'rowId',
          name: 'Row ID',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
          order: 2,
        },
      ])
    })

    it('should handle empty rows', () => {
      const mockData = {
        rows: [] as any[],
        columns: [
          { id: 'col1', name: 'Column 1', value: `data.rows.*.data.col1` },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
      expect(result.rows).toEqual([])
      expect(result.columns).toEqual([
        {
          id: 'col1',
          name: 'Column 1',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col1`,
          order: 1,
        },
      ])
    })

    it('should handle empty columns', () => {
      const mockData = {
        rows: [
          {
            data: {},
            rowId: 'row-1',
          },
        ],
        columns: [] as any[],
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
      expect(result.rows).toEqual(mockData.rows)
      expect(result.columns).toEqual([])
    })

    it('should handle single row with UUID column', () => {
      const colId = randomUUID()
      const mockData = {
        rows: [
          {
            data: {
              [colId]: 'Single Value',
            },
            rowId: 'single-row',
          },
        ],
        columns: [
          {
            id: colId,
            name: 'Single Column',
            value: `data.rows.*.data.${colId}`,
          },
        ],
        inputSource: FOR_EACH_INPUT_SOURCE.TILES,
      }

      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
      expect(result.columns).toEqual([
        {
          id: colId,
          name: 'Single Column',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${colId}`,
          order: 1,
        },
        {
          id: 'rowId',
          name: 'Row ID',
          value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
          order: 2,
        },
      ])
    })

    it('should handle empty rows and columns', () => {
      const mockData = {
        rows: [] as any[],
        columns: [] as any[],
        inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
      }
      const result = processItems(mockData, 'array')

      expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
      expect(result.rows).toEqual([])
      expect(result.columns).toEqual([])
    })
  })
})

describe('processItems - new dataOut format that can handle column reoder', () => {
  it('should process tiles data (with UUID column IDs)', () => {
    const col1Id = randomUUID()
    const col2Id = randomUUID()
    const mockData = {
      rows: [
        {
          data: {
            [col1Id]: 'Value 1',
            [col2Id]: 'Value 2',
          },
          rowId: randomUUID(),
        },
        {
          data: {
            [col1Id]: 3,
            [col2Id]: 4,
          },
          rowId: randomUUID(),
        },
      ],
      columns: [
        { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
        { id: col2Id, name: 'Column 2', value: `data.rows.*.data.${col2Id}` },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.TILES,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
    expect(result.rows).toEqual(mockData.rows)
    expect(result.columns).toEqual({
      [col1Id]: {
        id: col1Id,
        name: 'Column 1',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
        order: 1,
      },
      [col2Id]: {
        id: col2Id,
        name: 'Column 2',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col2Id}`,
        order: 2,
      },
      rowId: {
        id: 'rowId',
        name: 'Row ID',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
        order: 3,
      },
    })
  })

  it('should process tiles data (with ULID column IDs)', () => {
    // ULID format: 26 characters, base32 encoded
    const col1Id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const col2Id = '01BX5ZZKBKACTAV9WEVGEMMVS0'
    const mockData = {
      rows: [
        {
          data: {
            [col1Id]: 'Value 1',
            [col2Id]: 'Value 2',
          },
          rowId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        },
      ],
      columns: [
        { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
        { id: col2Id, name: 'Column 2', value: `data.rows.*.data.${col2Id}` },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.TILES,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
    expect(result.rows).toEqual(mockData.rows)
    expect(result.columns).toEqual({
      [col1Id]: {
        id: col1Id,
        name: 'Column 1',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
        order: 1,
      },
      [col2Id]: {
        id: col2Id,
        name: 'Column 2',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col2Id}`,
        order: 2,
      },
      rowId: {
        id: 'rowId',
        name: 'Row ID',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
        order: 3,
      },
    })
  })

  it('should process m365-excel data (with regular column IDs)', () => {
    const mockData = {
      rows: [
        {
          data: {
            col1: 1,
            col2: 2,
          },
        },
        {
          data: {
            col1: 'Excel Value 3',
            col2: 'Excel Value 4',
          },
        },
      ],
      columns: [
        {
          id: 'col1',
          name: 'Excel Column 1',
          value: `data.rows.*.data.col1`,
        },
        {
          id: 'col2',
          name: 'Excel Column 2',
          value: `data.rows.*.data.col2`,
        },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
    expect(result.rows).toEqual(mockData.rows)
    expect(result.columns).toEqual({
      col1: {
        id: 'col1',
        name: 'Excel Column 1',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col1`,
        order: 1,
      },
      col2: {
        id: 'col2',
        name: 'Excel Column 2',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col2`,
        order: 2,
      },
    })
  })

  it('should handle empty tiles rows', () => {
    const col1Id = randomUUID()
    const mockData = {
      rows: [] as any[],
      columns: [
        { id: col1Id, name: 'Column 1', value: `data.rows.*.data.${col1Id}` },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.TILES,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual({
      [col1Id]: {
        id: col1Id,
        name: 'Column 1',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${col1Id}`,
        order: 1,
      },
      rowId: {
        id: 'rowId',
        name: 'Row ID',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
        order: 2,
      },
    })
  })

  it('should handle empty rows', () => {
    const mockData = {
      rows: [] as any[],
      columns: [
        { id: 'col1', name: 'Column 1', value: `data.rows.*.data.col1` },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual({
      col1: {
        id: 'col1',
        name: 'Column 1',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.col1`,
        order: 1,
      },
    })
  })

  it('should handle empty columns', () => {
    const mockData = {
      rows: [
        {
          data: {},
          rowId: 'row-1',
        },
      ],
      columns: [] as any[],
      inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
    expect(result.rows).toEqual(mockData.rows)
    expect(result.columns).toEqual({})
  })

  it('should handle single row with UUID column', () => {
    const colId = randomUUID()
    const mockData = {
      rows: [
        {
          data: {
            [colId]: 'Single Value',
          },
          rowId: 'single-row',
        },
      ],
      columns: [
        {
          id: colId,
          name: 'Single Column',
          value: `data.rows.*.data.${colId}`,
        },
      ],
      inputSource: FOR_EACH_INPUT_SOURCE.TILES,
    }

    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)
    expect(result.columns).toEqual({
      [colId]: {
        id: colId,
        name: 'Single Column',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.data.${colId}`,
        order: 1,
      },
      rowId: {
        id: 'rowId',
        name: 'Row ID',
        value: `items.rows.${FOR_EACH_ITERATION_KEY}.rowId`,
        order: 2,
      },
    })
  })

  it('should handle empty rows and columns', () => {
    const mockData = {
      rows: [] as any[],
      columns: [] as any[],
      inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
    }
    const result = processItems(mockData, 'object')

    expect(result.inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
    expect(result.rows).toEqual([])
    expect(result.columns).toEqual({})
  })
})
