import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  baseLookupParametersSchema,
  fileIdSchema,
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

describe('baseLookupParametersSchema', () => {
  describe('accepts old format', () => {
    it('with lookupColumn and lookupValue', () => {
      expect(
        baseLookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          lookupColumn: 'Email',
          lookupValue: 'test@example.com',
        }),
      ).toHaveProperty('success', true)
    })

    it('with lookupColumn only', () => {
      expect(
        baseLookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          lookupColumn: 'Status',
        }),
      ).toHaveProperty('success', true)
    })
  })

  describe('accepts new format', () => {
    it('with filters array', () => {
      expect(
        baseLookupParametersSchema.safeParse({
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
        baseLookupParametersSchema.safeParse({
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

    it('with empty filters array', () => {
      expect(
        baseLookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          filters: [],
        }),
      ).toHaveProperty('success', true)
    })
  })

  describe('accepts both formats together', () => {
    it('with both old and new parameters', () => {
      expect(
        baseLookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          lookupColumn: 'OldColumn',
          lookupValue: 'old value',
          filters: [
            {
              lookupColumn: 'NewColumn',
              lookupValue: 'new value',
            },
          ],
        }),
      ).toHaveProperty('success', true)
    })
  })

  describe('accepts without lookup parameters', () => {
    it('with only fileId and tableId', () => {
      expect(
        baseLookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
        }),
      ).toHaveProperty('success', true)
    })
  })
})

describe('lookupParametersSchema (with validation)', () => {
  describe('accepts valid formats', () => {
    it('accepts old format with lookupColumn', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          lookupColumn: 'Email',
          lookupValue: 'test@example.com',
        }),
      ).toHaveProperty('success', true)
    })

    it('accepts new format with filters', () => {
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

    it('accepts both formats together', () => {
      expect(
        lookupParametersSchema.safeParse({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          lookupColumn: 'OldColumn',
          filters: [
            {
              lookupColumn: 'NewColumn',
              lookupValue: 'new value',
            },
          ],
        }),
      ).toHaveProperty('success', true)
    })
  })

  describe('rejects invalid formats', () => {
    it('rejects when neither format provided', () => {
      const result = lookupParametersSchema.safeParse({
        fileId: VALID_FILE_ID,
        tableId: VALID_TABLE_ID,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Either lookup column/value or filters must be provided',
        )
      }
    })

    it('rejects empty filters array without old format', () => {
      const result = lookupParametersSchema.safeParse({
        fileId: VALID_FILE_ID,
        tableId: VALID_TABLE_ID,
        filters: [],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Either lookup column/value or filters must be provided',
        )
      }
    })

    it('rejects null filters without old format', () => {
      const result = lookupParametersSchema.safeParse({
        fileId: VALID_FILE_ID,
        tableId: VALID_TABLE_ID,
        filters: null,
      })

      expect(result.success).toBe(false)
    })

    it('rejects undefined filters without old format', () => {
      const result = lookupParametersSchema.safeParse({
        fileId: VALID_FILE_ID,
        tableId: VALID_TABLE_ID,
        filters: undefined,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Either lookup column/value or filters must be provided',
        )
      }
    })

    it('rejects with only lookupValue (no lookupColumn)', () => {
      const result = lookupParametersSchema.safeParse({
        fileId: VALID_FILE_ID,
        tableId: VALID_TABLE_ID,
        lookupValue: 'some value',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Either lookup column/value or filters must be provided',
        )
      }
    })
  })
})
