import { IJSONObject } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { transformStepParameters } from '../../common/transform-parameters'

describe('transformStepParameters', () => {
  describe('transformLookupParameters - old format to new format', () => {
    it('transforms old lookup parameters to filters array', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      })
    })

    it('transforms with empty lookupValue', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Status',
        lookupValue: '',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Status',
            lookupValue: '',
          },
        ],
      })
    })

    it('transforms with missing lookupValue (undefined)', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Name',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Name',
            lookupValue: '',
          },
        ],
      })
    })

    it('preserves all other parameters during transformation', () => {
      const result = transformStepParameters('updateTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'ID',
        lookupValue: '42',
        columnsToUpdate: [{ columnName: 'Status', value: 'Complete' }],
        someOtherField: 'preserved',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        columnsToUpdate: [{ columnName: 'Status', value: 'Complete' }],
        someOtherField: 'preserved',
        filters: [
          {
            lookupColumn: 'ID',
            lookupValue: '42',
          },
        ],
      })
    })
  })

  describe('transformLookupParameters - idempotency', () => {
    it('is idempotent when filters already exist', () => {
      const input = {
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      }

      const result = transformStepParameters('getTableRow', input)

      expect(result).toEqual(input)
    })

    it('is idempotent when called multiple times', () => {
      const input = {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
      }

      const firstTransform = transformStepParameters('getTableRow', input)
      const secondTransform = transformStepParameters(
        'getTableRow',
        firstTransform,
      )
      const thirdTransform = transformStepParameters(
        'getTableRow',
        secondTransform,
      )

      expect(firstTransform).toEqual(secondTransform)
      expect(secondTransform).toEqual(thirdTransform)
    })

    it('prefers filters when both old and new formats present', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'OldColumn',
        lookupValue: 'old value',
        filters: [
          {
            lookupColumn: 'NewColumn',
            lookupValue: 'new value',
          },
        ],
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'NewColumn',
            lookupValue: 'new value',
          },
        ],
      })
    })

    it('removes old parameters when filters exist', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      })

      expect(result).not.toHaveProperty('lookupColumn')
      expect(result).not.toHaveProperty('lookupValue')
      expect(result).toHaveProperty('filters')
    })
  })

  describe('transformLookupParameters - edge cases', () => {
    it('handles empty filters array by falling back to old params', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
        filters: [],
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      })
    })

    it('handles null filters by falling back to old params', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
        filters: null,
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      })
    })

    it('handles undefined filters by falling back to old params', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
        filters: undefined,
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Email',
            lookupValue: 'test@example.com',
          },
        ],
      })
    })

    it('returns parameters unchanged when no transformation needed', () => {
      const input = {
        fileId: 'file123',
        tableId: 'table456',
        someOtherField: 'value',
      }

      const result = transformStepParameters('getTableRow', input)

      expect(result).toEqual(input)
    })

    it('handles parameters with only lookupColumn (no lookupValue)', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Status',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Status',
            lookupValue: '',
          },
        ],
      })
    })

    it('handles parameters with only lookupValue (no lookupColumn)', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupValue: 'some value',
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: undefined,
            lookupValue: 'some value',
          },
        ],
      })
    })
  })

  describe('transformStepParameters - action routing', () => {
    it('transforms getTableRow action', () => {
      const result = transformStepParameters('getTableRow', {
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
      })

      expect(result).toHaveProperty('filters')
    })

    it('transforms getTableRows action', () => {
      const result = transformStepParameters('getTableRows', {
        lookupColumn: 'Status',
        lookupValue: 'Active',
      })

      expect(result).toHaveProperty('filters')
    })

    it('transforms updateTableRow action', () => {
      const result = transformStepParameters('updateTableRow', {
        lookupColumn: 'ID',
        lookupValue: '123',
      })

      expect(result).toHaveProperty('filters')
    })

    it('returns parameters unchanged for non-transformable actions', () => {
      const input = {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Email',
        lookupValue: 'test@example.com',
      }

      const result = transformStepParameters('someOtherAction', input)

      // Should return unchanged
      expect(result).toEqual(input)
      expect(result).not.toHaveProperty('filters')
    })
  })

  describe('transformLookupParameters - real-world scenarios', () => {
    it('handles typical old Pipe from database', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tableId: '{01ABCDEFGHIJKLMNOPQRSTUVWXYZ}',
        lookupColumn: 'Email Address',
        lookupValue: '{{1.email}}',
      })

      expect(result).toEqual({
        fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tableId: '{01ABCDEFGHIJKLMNOPQRSTUVWXYZ}',
        filters: [
          {
            lookupColumn: 'Email Address',
            lookupValue: '{{1.email}}',
          },
        ],
      })
    })

    it('handles new Pipe with filters', () => {
      const input = {
        fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tableId: '{01ABCDEFGHIJKLMNOPQRSTUVWXYZ}',
        filters: [
          {
            lookupColumn: 'Email Address',
            lookupValue: '{{1.email}}',
          },
        ],
      }

      const result = transformStepParameters('getTableRow', input)

      expect(result).toEqual(input)
    })

    it('handles update action with columnsToUpdate', () => {
      const result = transformStepParameters('updateTableRow', {
        fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tableId: '{01ABCDEFGHIJKLMNOPQRSTUVWXYZ}',
        lookupColumn: 'ID',
        lookupValue: '{{1.id}}',
        columnsToUpdate: [
          {
            columnName: 'Status',
            value: 'Completed',
          },
          {
            columnName: 'Updated At',
            value: '{{1.timestamp}}',
          },
        ],
      })

      expect(result).toEqual({
        fileId: '01ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tableId: '{01ABCDEFGHIJKLMNOPQRSTUVWXYZ}',
        columnsToUpdate: [
          {
            columnName: 'Status',
            value: 'Completed',
          },
          {
            columnName: 'Updated At',
            value: '{{1.timestamp}}',
          },
        ],
        filters: [
          {
            lookupColumn: 'ID',
            lookupValue: '{{1.id}}',
          },
        ],
      })
    })

    it('handles special characters in lookup values', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Name',
        lookupValue: "O'Brien, Inc. & Co. <test@example.com>",
      })

      expect((result.filters as IJSONObject[])?.[0]?.lookupValue).toBe(
        "O'Brien, Inc. & Co. <test@example.com>",
      )
    })

    it('handles numeric lookupValue (coerced to string)', () => {
      const result = transformStepParameters('getTableRow', {
        fileId: 'file123',
        tableId: 'table456',
        lookupColumn: 'Age',
        lookupValue: 42,
      })

      expect(result).toEqual({
        fileId: 'file123',
        tableId: 'table456',
        filters: [
          {
            lookupColumn: 'Age',
            lookupValue: 42,
          },
        ],
      })
    })
  })
})
