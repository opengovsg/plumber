import { describe, expect, it } from 'vitest'
import type { SafeParseError } from 'zod'

import schema from '../../auth/schema'

describe('gathersg auth schema', () => {
  describe('valid cases', () => {
    it('accepts updatedBy with email and name', () => {
      const result = schema.safeParse({
        updatedBy: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts createdBy with email and name', () => {
      const result = schema.safeParse({
        createdBy: {
          email: 'user@example.com',
          name: 'Jane Doe',
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts both updatedBy and createdBy when updatedBy has email', () => {
      const result = schema.safeParse({
        updatedBy: {
          email: 'updater@example.com',
          name: 'Updater',
        },
        createdBy: {
          email: 'creator@example.com',
          name: 'Creator',
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts FormSG createdBy with formsg data', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: 'form-123',
          submissionId: 'submission-456',
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts FormSG createdBy without email when formsg data is present', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: '64abc123def456',
          submissionId: 'sub-789xyz',
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts the email-sourced createdBy sentinel (name/role/uuid all "Email"/"email") without a createdBy.email field', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Email',
          role: 'email',
          uuid: 'email',
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('email-sourced createdBy invalid cases', () => {
    it('rejects when uuid is missing (not the exact sentinel shape)', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Email',
          role: 'email',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects when name does not match "Email"', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Not Email',
          role: 'email',
          uuid: 'email',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects when role does not match "email"', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Email',
          role: 'user',
          uuid: 'email',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects when uuid does not match "email"', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Email',
          role: 'email',
          uuid: 'some-real-uuid',
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('invalid cases - missing email', () => {
    it('rejects updatedBy without email', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'John Doe',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects createdBy without email when not FormSG', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Regular User',
        },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const { issues } = (result as SafeParseError<unknown>).error
        expect(
          issues.some((i) => i.message.includes('createdBy.email is required')),
        ).toBe(true)
      }
    })

    it('rejects when both updatedBy and createdBy exist but updatedBy has no email', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'Updater',
        },
        createdBy: {
          email: 'creator@example.com',
          name: 'Creator',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty object (neither updatedBy nor createdBy)', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects null values', () => {
      const result = schema.safeParse({
        updatedBy: null,
        createdBy: null,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('FormSG invalid cases', () => {
    it('rejects FormSG createdBy without formId', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          submissionId: 'submission-456',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects FormSG createdBy without submissionId', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: 'form-123',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects FormSG createdBy with empty formId', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: '',
          submissionId: 'submission-456',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects FormSG createdBy with empty submissionId', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: 'form-123',
          submissionId: '',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects FormSG createdBy without formsg object', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('empty string validation', () => {
    it('rejects updatedBy with empty email', () => {
      const result = schema.safeParse({
        updatedBy: {
          email: '',
          name: 'John Doe',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects updatedBy with empty name', () => {
      const result = schema.safeParse({
        updatedBy: {
          email: 'user@example.com',
          name: '',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects createdBy with empty name', () => {
      const result = schema.safeParse({
        createdBy: {
          email: 'user@example.com',
          name: '',
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('precedence logic', () => {
    it('prioritizes updatedBy.email when both updatedBy and createdBy exist', () => {
      // This should pass because updatedBy has email, even though createdBy doesn't
      const result = schema.safeParse({
        updatedBy: {
          email: 'updater@example.com',
          name: 'Updater',
        },
        createdBy: {
          name: 'Creator',
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates updatedBy.email presence when both exist', () => {
      // This should fail because updatedBy doesn't have email
      const result = schema.safeParse({
        updatedBy: {
          name: 'Updater',
        },
        createdBy: {
          email: 'creator@example.com',
          name: 'Creator',
        },
      })
      expect(result.success).toBe(false)
    })
  })
})
