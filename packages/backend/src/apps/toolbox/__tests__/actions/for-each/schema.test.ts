import { describe, expect, it } from 'vitest'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import { MultipleRowObject } from '@/apps/toolbox/common/get-for-each-variables'

import { inputSchema } from '../../../actions/for-each/schema'

describe('inputSchema', () => {
  describe('table input format', () => {
    it.each([true, false])(
      'should handle valid table input for testRun: %s',
      (testRun) => {
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
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        }

        const result = inputSchema.safeParse({ data: validTableInput, testRun })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.TILES)

          if (inputSource === FOR_EACH_INPUT_SOURCE.TILES) {
            expect((items as MultipleRowObject).rows).toHaveLength(2)
            expect((items as MultipleRowObject).columns).toHaveLength(2)
            expect((items as MultipleRowObject).rows[0].data.name).toBe('John')
            expect((items as MultipleRowObject).rows[0].rowId).toBe('row1')
            expect((items as MultipleRowObject).rows[1].rowId).toBeUndefined()
          }
        }
      },
    )

    it.each([true, false])(
      'should handle table input without rowId for testRun: %s',
      (testRun) => {
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
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        }

        const result = inputSchema.safeParse({ data: validTableInput, testRun })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.M365_EXCEL)
          if (inputSource === FOR_EACH_INPUT_SOURCE.M365_EXCEL) {
            expect((items as MultipleRowObject).rows[0].data.score).toBe(95.5)
          }
        }
      },
    )

    it.each([true, false])(
      'should reject table input with missing rows for testRun: %s',
      (testRun) => {
        const invalidTableInput = {
          columns: [{ id: 'name', name: 'Name', value: 'name' }],
        }

        const result = inputSchema.safeParse({
          data: invalidTableInput,
          testRun,
        })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Invalid input')
        }
      },
    )

    it.each([true, false])(
      'should reject table input with missing columns for testRun: %s',
      (testRun) => {
        const invalidTableInput = {
          rows: [
            {
              data: { name: 'John' },
            },
          ],
        }

        const result = inputSchema.safeParse({
          data: invalidTableInput,
          testRun,
        })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Invalid input')
        }
      },
    )

    it.each([true, false])(
      'should reject table input with invalid row structure for testRun: %s',
      (testRun) => {
        const invalidTableInput = {
          rows: [
            {
              invalidField: 'test',
            },
          ],
          columns: [{ id: 'name', name: 'Name', value: 'name' }],
        }

        const result = inputSchema.safeParse({
          data: invalidTableInput,
          testRun,
        })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Invalid input')
        }
      },
    )

    it.each([true, false])(
      'should reject table input with invalid column structure for testRun: %s',
      (testRun) => {
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

        const result = inputSchema.safeParse({
          data: invalidTableInput,
          testRun,
        })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Invalid input')
        }
      },
    )

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
    ])('should reject malformed JSON for testRun: %s', ({ input, error }) => {
      const resTestRun = inputSchema.safeParse({ data: input, testRun: true })

      expect(resTestRun.success).toBe(false)
      if (resTestRun.success === false) {
        expect(resTestRun.error.issues[0].message).toBe(error)
      }

      const resActual = inputSchema.safeParse({
        data: input,
        testRun: false,
      })

      expect(resActual.success).toBe(false)
      if (resActual.success === false) {
        expect(resActual.error.issues[0].message).toBe(error)
      }
    })

    it('should reject table input without inputSource', () => {
      const invalidTableInput = {
        rows: [
          {
            data: { name: 'John' },
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
  })

  describe('checkbox input format', () => {
    it.each([true, false])(
      'should handle single item for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({ data: ['item1'], testRun })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
          expect(items).toEqual(['item1'])
        }
      },
    )

    it.each([true, false])(
      'should handle multiple comma-separated items for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({
          data: ['item1', 'item2', 'item3'],
          testRun,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
          expect(items).toEqual(['item1', 'item2', 'item3'])
        }
      },
    )

    it.each([true, false])(
      'should handle items with spaces for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({
          data: ['item 1', ' item 2 ', ' item 3'],
          testRun,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
          expect(items).toEqual(['item 1', ' item 2 ', ' item 3'])
        }
      },
    )

    it.each([true, false])(
      'should handle empty items in comma-separated list for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({
          data: ['item1', '', 'item3'],
          testRun,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
          expect(items).toEqual(['item1', '', 'item3'])
        }
      },
    )

    it.each([true, false])(
      'should not trim whitespace for checkbox items for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({
          data: ['  item1', 'item2  '],
          testRun,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          const { inputSource, items } = result.data
          expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
          expect(items).toEqual(['  item1', 'item2  '])
        }
      },
    )

    it.each([true, false])(
      'should reject single comma for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({ data: ',', testRun })

        expect(result.success).toBe(false)
        if (result.success == false) {
          expect(result.error.issues[0].message).toBe('Invalid input')
        }
      },
    )

    it('should reject empty array on test run', () => {
      const result = inputSchema.safeParse({ data: [], testRun: true })

      expect(result.success).toBe(false)
      if (result.success == false) {
        expect(result.error.issues[0].message).toBe('Input cannot be empty')
      }
    })

    it('should handle empty array on actual run', () => {
      const result = inputSchema.safeParse({ data: [], testRun: false })

      expect(result.success).toBe(true)
      if (result.success) {
        const { inputSource, items } = result.data
        expect(inputSource).toBe(FOR_EACH_INPUT_SOURCE.STRING_ARRAY)
        expect(items).toEqual([])
      }
    })
  })

  describe('FormSG Table field', () => {
    const hexEncodedColumns = [
      Buffer.from('Column 1').toString('hex'),
      Buffer.from('Column 2').toString('hex'),
    ]
    const mockTableFieldData = {
      rows: [
        {
          data: { [hexEncodedColumns[0]]: 'John', [hexEncodedColumns[1]]: 25 },
        },
        {
          data: { [hexEncodedColumns[0]]: 'Jane', [hexEncodedColumns[1]]: 30 },
        },
      ],
      columns: [
        {
          id: hexEncodedColumns[0],
          name: 'Column 1',
          value: `data.rows.*.data.${hexEncodedColumns[0]}`,
        },
        {
          id: hexEncodedColumns[1],
          name: 'Column 2',
          value: `data.rows.*.data.${hexEncodedColumns[1]}`,
        },
      ],
    }

    it.each([true, false])(
      'should handle FormSG Table field for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({
          data: JSON.stringify(mockTableFieldData),
          testRun,
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.type).toBe('table')
          expect(result.data.items.rows).toHaveLength(2)
          expect(result.data.items.rows[0].data[hexEncodedColumns[0]]).toBe(
            'John',
          )
          expect(result.data.items.rows[0].data[hexEncodedColumns[1]]).toBe(25)
          expect(result.data.items.rows[1].data[hexEncodedColumns[0]]).toBe(
            'Jane',
          )
          expect(result.data.items.rows[1].data[hexEncodedColumns[1]]).toBe(30)
          expect(result.data.items.columns).toHaveLength(2)
          expect(result.data.items.columns[0].id).toBe(hexEncodedColumns[0])
          expect(result.data.items.columns[0].name).toBe('Column 1')
          expect(result.data.items.columns[0].value).toBe(
            `data.rows.*.data.${hexEncodedColumns[0]}`,
          )
          expect(result.data.items.columns[1].id).toBe(hexEncodedColumns[1])
          expect(result.data.items.columns[1].name).toBe('Column 2')
          expect(result.data.items.columns[1].value).toBe(
            `data.rows.*.data.${hexEncodedColumns[1]}`,
          )
        }
      },
    )

    it.each([true, false])(
      'should handle FormSG Table field with no row data for testRun: %s',
      (testRun) => {
        const emptyTableData = JSON.stringify({
          rows: [
            {
              data: {
                [hexEncodedColumns[0]]: '',
                [hexEncodedColumns[1]]: '',
              },
            },
          ],
          columns: mockTableFieldData.columns,
        })
        const result = inputSchema.safeParse({ data: emptyTableData, testRun })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.type).toBe('table')
          expect(result.data.items.rows).toHaveLength(1)
          expect(result.data.items.rows[0].data[hexEncodedColumns[0]]).toBe('')
          expect(result.data.items.rows[0].data[hexEncodedColumns[1]]).toBe('')
          expect(result.data.items.columns).toHaveLength(2)
          expect(result.data.items.columns[0].id).toBe(hexEncodedColumns[0])
          expect(result.data.items.columns[1].id).toBe(hexEncodedColumns[1])
        }
      },
    )
  })

  describe('edge cases and validation', () => {
    it.each([true, false])(
      'should reject empty string for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({ data: '', testRun })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Input cannot be empty')
        }
      },
    )

    it.each([true, false])(
      'should reject whitespace-only string for testRun: %s',
      (testRun) => {
        const result = inputSchema.safeParse({ data: '   ', testRun })

        expect(result.success).toBe(false)
        if (result.success === false) {
          expect(result.error.issues[0].message).toBe('Input cannot be empty')
        }
      },
    )
  })
})
