import { describe, expect, it } from 'vitest'

import {
  extractErrorCode,
  extractErrorMessage,
  extractErrorMessages,
  isUniqueViolation,
} from '../pg-error'

describe('pg-error extractors', () => {
  describe('extractErrorCode', () => {
    it('returns err.code when set directly', () => {
      const err = Object.assign(new Error('boom'), { code: '08006' })
      expect(extractErrorCode(err)).toBe('08006')
    })

    it('falls back to err.nativeError.code (Objection DBError wrapper)', () => {
      const native = Object.assign(new Error('inner'), { code: '23505' })
      const err = Object.assign(new Error('outer'), { nativeError: native })
      expect(extractErrorCode(err)).toBe('23505')
    })

    it('prefers top-level code over nativeError.code', () => {
      const native = Object.assign(new Error('inner'), { code: '23505' })
      const err = Object.assign(new Error('outer'), {
        code: '08006',
        nativeError: native,
      })
      expect(extractErrorCode(err)).toBe('08006')
    })

    it('returns undefined for a plain Error', () => {
      expect(extractErrorCode(new Error('plain'))).toBeUndefined()
    })

    it('returns undefined when code is not a string', () => {
      const err = Object.assign(new Error('boom'), { code: 8006 })
      expect(extractErrorCode(err)).toBeUndefined()
    })

    it('returns undefined for null / undefined / non-object', () => {
      expect(extractErrorCode(null)).toBeUndefined()
      expect(extractErrorCode(undefined)).toBeUndefined()
      expect(extractErrorCode('error string')).toBeUndefined()
      expect(extractErrorCode(42)).toBeUndefined()
    })
  })

  describe('extractErrorMessages', () => {
    it('returns [err.message] for a plain Error', () => {
      expect(extractErrorMessages(new Error('boom'))).toEqual(['boom'])
    })

    it('includes both top-level and nativeError messages when present', () => {
      const native = new Error('inner boom')
      const err = Object.assign(new Error('outer boom'), {
        nativeError: native,
      })
      expect(extractErrorMessages(err)).toEqual(['outer boom', 'inner boom'])
    })

    it('returns empty array for null / undefined', () => {
      expect(extractErrorMessages(null)).toEqual([])
      expect(extractErrorMessages(undefined)).toEqual([])
    })

    it('returns empty array when message is missing', () => {
      expect(extractErrorMessages({})).toEqual([])
    })
  })

  describe('extractErrorMessage', () => {
    it('returns the first message', () => {
      const native = new Error('inner')
      const err = Object.assign(new Error('outer'), { nativeError: native })
      expect(extractErrorMessage(err)).toBe('outer')
    })

    it('returns undefined when no messages are present', () => {
      expect(extractErrorMessage(null)).toBeUndefined()
      expect(extractErrorMessage({})).toBeUndefined()
    })
  })

  describe('isUniqueViolation', () => {
    it('is true for code 23505', () => {
      const err = Object.assign(new Error('dup'), { code: '23505' })
      expect(isUniqueViolation(err)).toBe(true)
    })

    it('is true when nativeError.code is 23505', () => {
      const native = Object.assign(new Error('dup'), { code: '23505' })
      const err = Object.assign(new Error('wrapped'), { nativeError: native })
      expect(isUniqueViolation(err)).toBe(true)
    })

    it('is false for other codes and missing codes', () => {
      expect(
        isUniqueViolation(Object.assign(new Error('x'), { code: '08006' })),
      ).toBe(false)
      expect(isUniqueViolation(new Error('x'))).toBe(false)
      expect(isUniqueViolation(null)).toBe(false)
    })
  })
})
