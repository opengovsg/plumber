import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { fileIdSchema, tableIdSchema } from '../../common/schema'

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
