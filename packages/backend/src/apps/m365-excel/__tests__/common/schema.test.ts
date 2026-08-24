import type { IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  fileIdSchema,
  filtersSchema,
  lookupParametersSchema,
  tableIdSchema,
} from '../../common/schema'

const VALID_FILE_ID = '1234ABCD1234ABCD1234ABCD1234ABCD'
const VALID_TABLE_ID = `{${VALID_FILE_ID}}`

describe('validate dynamic fields', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        position: 2,
      },
      app: {
        name: 'test-app',
      },
    } as unknown as IGlobalVariable
  })

  const parametersSchema = z.object({
    fileId: fileIdSchema,
    tableId: tableIdSchema,
  })

  describe('invalid fields', () => {
    it('empty file id', () => {
      expect(
        parametersSchema.safeParse({
          fileId: '',
          tableId: VALID_TABLE_ID,
        }),
      ).toHaveProperty('success', false)
    })

    it('path traversal spotted', () => {
      const INVALID_FILE_ID = `../../${VALID_FILE_ID}`
      expect(
        parametersSchema.safeParse({
          fileId: INVALID_FILE_ID,
          tableId: VALID_TABLE_ID,
        }),
      ).toHaveProperty('success', false)
    })

    it('table id has no braces', () => {
      expect(
        parametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_FILE_ID,
        }),
      ).toHaveProperty('success', false)
    })
  })

  describe('valid fields', () => {
    it('test 1', () => {
      expect(
        parametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          $,
        }),
      ).toHaveProperty('success', true)
    })

    it('test 2', () => {
      expect(
        parametersSchema.safeParse({
          fileId: '123ABC',
          tableId: '{456-XYZ}',
          $,
        }),
      ).toHaveProperty('success', true)
    })
  })
})

describe('filtersSchema', () => {
  describe('invalid filters', () => {
    it('rejects empty array', () => {
      expect(filtersSchema.safeParse([])).toHaveProperty('success', false)
    })

    it('rejects duplicate lookup columns', () => {
      expect(
        filtersSchema.safeParse([
          { lookupColumn: 'Name', lookupValue: 'Alice' },
          { lookupColumn: 'Name', lookupValue: 'Bob' },
        ]),
      ).toHaveProperty('success', false)
    })

    it('rejects multiple duplicates across filters', () => {
      expect(
        filtersSchema.safeParse([
          { lookupColumn: 'Name', lookupValue: 'Alice' },
          { lookupColumn: 'Age', lookupValue: '30' },
          { lookupColumn: 'Name', lookupValue: 'Bob' },
        ]),
      ).toHaveProperty('success', false)
    })
  })

  describe('valid filters', () => {
    it('accepts a single filter', () => {
      expect(
        filtersSchema.safeParse([
          { lookupColumn: 'Name', lookupValue: 'Alice' },
        ]),
      ).toHaveProperty('success', true)
    })

    it('accepts multiple filters with unique columns', () => {
      expect(
        filtersSchema.safeParse([
          { lookupColumn: 'Name', lookupValue: 'Alice' },
          { lookupColumn: 'Age', lookupValue: '30' },
          { lookupColumn: 'Department', lookupValue: 'Engineering' },
        ]),
      ).toHaveProperty('success', true)
    })

    it('defaults lookupValue to empty string when omitted', () => {
      const result = filtersSchema.safeParse([{ lookupColumn: 'Name' }])
      expect(result).toHaveProperty('success', true)
      if (result.success) {
        expect(result.data[0].lookupValue).toBe('')
      }
    })
  })
})

describe('lookupParametersSchema', () => {
  describe('accepts new format', () => {
    it('with filters array', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          filters: [
            {
              lookupColumn: 'Email',
              lookupValue: 'test@example.com',
            },
          ],
        }),
      ).toHaveProperty('success', true)
    })

    it('with multiple filters', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          filters: [
            {
              lookupColumn: 'Status',
              lookupValue: 'Active',
            },
            {
              lookupColumn: 'Department',
              lookupValue: 'Engineering',
            },
          ],
        }),
      ).toHaveProperty('success', true)
    })

    it('with exactly 3 filters (max allowed)', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          filters: [
            {
              lookupColumn: 'Status',
              lookupValue: 'Active',
            },
            {
              lookupColumn: 'Department',
              lookupValue: 'Engineering',
            },
            {
              lookupColumn: 'Level',
              lookupValue: 'Senior',
            },
          ],
        }),
      ).toHaveProperty('success', true)
    })

    it('with empty filters array', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          filters: [],
        }),
      ).toHaveProperty('success', false)
    })
  })
})
