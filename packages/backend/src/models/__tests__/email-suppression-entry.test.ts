import { describe, expect, it } from 'vitest'

import EmailSuppressionEntry from '@/models/email-suppression-entry'

describe('EmailSuppressionEntry model', () => {
  describe('tableName', () => {
    it('should use email_suppression table', () => {
      expect(EmailSuppressionEntry.tableName).toBe('email_suppression')
    })
  })

  describe('jsonSchema', () => {
    it('should require email and reason', () => {
      expect(EmailSuppressionEntry.jsonSchema.required).toEqual([
        'email',
        'reason',
      ])
    })
  })

  describe('getSuppressedEmails', () => {
    it('should return empty array for empty input', async () => {
      const result = await EmailSuppressionEntry.getSuppressedEmails([])
      expect(result).toEqual([])
    })
  })

  describe('whitelistEmails', () => {
    it('should return empty array for empty input', async () => {
      const result = await EmailSuppressionEntry.whitelistEmails([])
      expect(result).toEqual([])
    })
  })
})
