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
        validateDynamicFieldsAndThrowError('', VALID_TABLE_ID, $),
      ).toThrow(INVALID_FILE_ID_ERROR_PREFIX)
    })

    it('undefined table id', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError(VALID_FILE_ID, undefined, $),
      ).toThrow(INVALID_TABLE_ID_ERROR_PREFIX)
    })

    it('path traversal spotted', () => {
      const INVALID_FILE_ID = `../../${VALID_FILE_ID}`
      expect(() =>
        validateDynamicFieldsAndThrowError(INVALID_FILE_ID, VALID_TABLE_ID, $),
      ).toThrow(INVALID_FILE_ID_ERROR_PREFIX)
    })

    it('table id has no braces', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError(VALID_FILE_ID, VALID_FILE_ID, $),
      ).toThrow(INVALID_TABLE_ID_ERROR_PREFIX)
    })
  })

  describe('valid fields', () => {
    it('test 1', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError(VALID_FILE_ID, VALID_TABLE_ID, $),
      ).not.toThrow(StepError)
    })

    it('test 2', () => {
      expect(() =>
        validateDynamicFieldsAndThrowError('123ABC', '{456-XYZ}', $),
      ).not.toThrow(StepError)
    })
  })
})
