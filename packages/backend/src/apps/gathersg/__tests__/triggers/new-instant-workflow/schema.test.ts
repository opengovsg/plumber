import { describe, expect, it } from 'vitest'
import type { ZodIssue, ZodSafeParseError } from 'zod'

import { encryptionKeySchema } from '../../../triggers/new-instant-workflow/schema'

describe('encryptionKeySchema', () => {
  it('accepts a valid key', () => {
    const valid = 'Abcdefghij1$'
    const parsed = encryptionKeySchema.safeParse(valid)
    expect(parsed.success).toBe(true)
  })

  it('rejects keys shorter than 12 chars', () => {
    const result = encryptionKeySchema.safeParse('Abcdef1$A')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) => i.message.includes('be at least 12')),
      ).toBe(true)
    }
  })

  it('rejects keys longer than 20 chars', () => {
    const result = encryptionKeySchema.safeParse('Abcdefghijklmnopqr1$S')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) => i.message.includes('be at most 20')),
      ).toBe(true)
    }
  })

  it('requires at least one number', () => {
    const result = encryptionKeySchema.safeParse('Abcdefghijk$')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('contain at least 1 number'),
        ),
      ).toBe(true)
    }
  })

  it('requires at least one uppercase letter', () => {
    const result = encryptionKeySchema.safeParse('abcdefghi1$z')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('contain at least 1 uppercase letter'),
        ),
      ).toBe(true)
    }
  })

  it('requires at least one special character', () => {
    const result = encryptionKeySchema.safeParse('Abcdefghij12')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('contain at least 1 special character'),
        ),
      ).toBe(true)
    }
  })

  it('rejects leading whitespace', () => {
    const result = encryptionKeySchema.safeParse(' Abcdefghij1$')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('not have leading or trailing whitespace'),
        ),
      ).toBe(true)
    }
  })

  it('rejects trailing whitespace', () => {
    const result = encryptionKeySchema.safeParse('Abcdefghij1$ ')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('not have leading or trailing whitespace'),
        ),
      ).toBe(true)
    }
  })

  it('rejects both leading and trailing whitespace', () => {
    const result = encryptionKeySchema.safeParse(' Abcdefghij1$ ')
    expect(result.success).toBe(false)
    if (!result.success) {
      const { issues } = (result as unknown as ZodSafeParseError<string>).error
      expect(
        issues.some((i: ZodIssue) =>
          i.message.includes('not have leading or trailing whitespace'),
        ),
      ).toBe(true)
    }
  })
})
