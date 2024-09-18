import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'

const VALID_FILE_ID = '1234ABCD1234ABCD1234ABCD1234ABCD'
const VALID_TABLE_ID = `{${VALID_FILE_ID}}`
const INVALID_FILE_ID_ERROR_PREFIX = 'Your file'
const INVALID_TABLE_ID_ERROR_PREFIX = 'Your table'

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

  describe('invalid fields', () => {
    it('empty file id', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError({
          fileId: '',
          tableId: VALID_TABLE_ID,
          $,
        }),
      ).toThrow(INVALID_FILE_ID_ERROR_PREFIX)
    })

    it('path traversal spotted', () => {
      const INVALID_FILE_ID = `../../${VALID_FILE_ID}`
      expect(() =>
        validateDynamicFieldsAndThrowError({
          fileId: INVALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          $,
        }),
      ).toThrow(INVALID_FILE_ID_ERROR_PREFIX)
    })

    it('table id has no braces', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError({
          fileId: VALID_FILE_ID,
          tableId: VALID_FILE_ID,
          $,
        }),
      ).toThrow(INVALID_TABLE_ID_ERROR_PREFIX)
    })
  })

  describe('valid fields', () => {
    it('test 1', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError({
          fileId: VALID_FILE_ID,
          tableId: VALID_TABLE_ID,
          $,
        }),
      ).not.toThrow(StepError)
    })

    it('test 2', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError({
          fileId: '123ABC',
          tableId: '{456-XYZ}',
          $,
        }),
      ).not.toThrow(StepError)
    })
  })
})
