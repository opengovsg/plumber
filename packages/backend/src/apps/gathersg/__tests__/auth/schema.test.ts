import { describe, expect, it } from 'vitest'

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

    it('accepts Workflow updatedBy with createdBy', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'Workflow',
        },
        createdBy: {
          email: 'creator@example.com',
          name: 'Creator',
        },
      })
      expect(result.success).toBe(true)
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
    })

    it('rejects createdBy with email null when not FormSG', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'Regular User',
          email: null,
        },
      })
      expect(result.success).toBe(false)
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

    it('rejects when both updatedBy and createdBy exist but updatedBy email is null', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'Updater',
          email: null,
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

    it('rejects FormSG createdBy with submissionId null', () => {
      const result = schema.safeParse({
        createdBy: {
          name: 'FormSG',
        },
        formsg: {
          formId: 'form-123',
          submissionId: null,
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

  describe('Workflow invalid case', () => {
    it('rejects updatedBy with name "Workflow" when email is present', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'Workflow',
          email: 'workflow@example.com',
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects Workflow updatedBy when email is present even with valid createdBy', () => {
      const result = schema.safeParse({
        updatedBy: {
          name: 'Workflow',
          email: 'workflow@example.com',
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
