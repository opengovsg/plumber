import { describe, expect, it } from 'vitest'

import { inputSchema } from '../../../actions/for-each/schema'

describe('inputSchema', () => {
  describe('table input format', () => {
    it('should handle valid table input', () => {
      const validTableInput = {
        rows: [
          {
            data: { name: 'John', age: 25 },
            rowId: 'row1',
          },
          {
            data: { name: 'Jane', age: 30 },
          },
        ],
        columns: [
          { id: 'name', name: 'Name', value: 'name' },
          { id: 'age', name: 'Age', value: 'age' },
        ],
      }

      const result = inputSchema.safeParse(validTableInput)

      expect(result.success).toBe(true)
      if (result.success) {
        const { type, items } = result.data
        expect(type).toBe('table')
        if (type === 'table') {
          expect(items.rows).toHaveLength(2)
          expect(items.columns).toHaveLength(2)
          expect(items.rows[0].data.name).toBe('John')
          expect(items.rows[0].rowId).toBe('row1')
          expect(items.rows[1].rowId).toBeUndefined()
        }
      }
    })

    it('should handle table input without rowId', () => {
      const validTableInput = {
        rows: [
          {
            data: { name: 'Alice', score: 95.5 },
          },
        ],
        columns: [
          { id: 'name', name: 'Name', value: 'name' },
          { id: 'score', name: 'Score', value: 'score' },
        ],
      }

      const result = inputSchema.safeParse(validTableInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('table')
        if (result.data.type === 'table') {
          expect(result.data.items.rows[0].data.score).toBe(95.5)
        }
      }
    })

    it('should reject table input with missing rows', () => {
      const invalidTableInput = {
        columns: [{ id: 'name', name: 'Name', value: 'name' }],
      }

      const result = inputSchema.safeParse(invalidTableInput)

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })

    it('should reject table input with missing columns', () => {
      const invalidTableInput = {
        rows: [
          {
            data: { name: 'John' },
          },
        ],
      }

      const result = inputSchema.safeParse(invalidTableInput)

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })

    it('should reject table input with invalid row structure', () => {
      const invalidTableInput = {
        rows: [
          {
            invalidField: 'test',
          },
        ],
        columns: [{ id: 'name', name: 'Name', value: 'name' }],
      }

      const result = inputSchema.safeParse(invalidTableInput)

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })

    it('should reject table input with invalid column structure', () => {
      const invalidTableInput = {
        rows: [
          {
            data: { name: 'John' },
          },
        ],
        columns: [
          { id: 'name', name: 'Name' }, // missing 'value' field
        ],
      }

      const result = inputSchema.safeParse(invalidTableInput)

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })

    it.each([
      {
        input: '{ "rows": [invalid json',
        error: 'Invalid input',
      },
      {
        input: '{"item1": value1, "item2": "value2"}',
        error: 'Invalid input',
      },
      {
        input: 'item1,item2}',
        error: 'Invalid input',
      },
    ])('should reject malformed JSON', ({ input, error }) => {
      const result = inputSchema.safeParse(input)

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe(error)
      }
    })
  })

  describe('checkbox input format', () => {
    it('should handle single item', () => {
      const result = inputSchema.safeParse(['item1'])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('checkbox')
        expect(result.data.items).toEqual(['item1'])
      }
    })

    it('should handle multiple comma-separated items', () => {
      const result = inputSchema.safeParse(['item1', 'item2', 'item3'])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('checkbox')
        expect(result.data.items).toEqual(['item1', 'item2', 'item3'])
      }
    })

    it('should handle items with spaces', () => {
      const result = inputSchema.safeParse(['item 1', ' item 2 ', ' item 3'])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('checkbox')
        expect(result.data.items).toEqual(['item 1', ' item 2 ', ' item 3'])
      }
    })

    it('should handle empty items in comma-separated list', () => {
      const result = inputSchema.safeParse(['item1', '', 'item3'])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('checkbox')
        expect(result.data.items).toEqual(['item1', '', 'item3'])
      }
    })

    it('should not trim whitespace for checkbox items', () => {
      const result = inputSchema.safeParse(['  item1', 'item2  '])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('checkbox')
        expect(result.data.items).toEqual(['  item1', 'item2  '])
      }
    })

    it('should reject single comma', () => {
      const result = inputSchema.safeParse(',')

      expect(result.success).toBe(false)
      if (result.success == false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })
  })

  describe('edge cases and validation', () => {
    it('should reject empty string', () => {
      const result = inputSchema.safeParse('')

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })

    it('should reject whitespace-only string', () => {
      const result = inputSchema.safeParse('   ')

      expect(result.success).toBe(false)
      if (result.success === false) {
        expect(result.error.issues[0].message).toBe('Invalid input')
      }
    })
  })
})
