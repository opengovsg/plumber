import { beforeEach, describe, expect, it } from 'vitest'

import EmailSuppressionEntry from '../email-suppression-entry'

describe('EmailSuppressionEntry model', () => {
  const testEmail = 'bounce@example.com'

  describe('upsertSuppression', () => {
    it('should insert a new suppression record', async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
        sesMessageId: 'msg-001',
      })

      const row = await EmailSuppressionEntry.query().findOne({
        email: testEmail,
      })
      expect(row).toBeDefined()
      expect(row.reason).toBe('BOUNCE')
      expect(row.reasonDetail).toBe('NoEmail')
      expect(row.sesMessageId).toBe('msg-001')
      expect(row.whitelistCount).toBe(0)
      expect(row.lastWhitelistedAt).toBeNull()
    })

    it('should be idempotent — re-inserting same email updates fields', async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
      })
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'General',
        sesMessageId: 'msg-002',
      })

      const rows = await EmailSuppressionEntry.query().where({
        email: testEmail,
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].reasonDetail).toBe('General')
      expect(rows[0].sesMessageId).toBe('msg-002')
      expect(rows[0].whitelistCount).toBe(0)
    })

    it('should increment whitelist_count when re-suppressing a whitelisted email', async () => {
      // Suppress
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
      })
      // Whitelist
      await EmailSuppressionEntry.whitelistEmails([testEmail])
      // Re-suppress
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
      })

      const row = await EmailSuppressionEntry.query().findOne({
        email: testEmail,
      })
      expect(row.whitelistCount).toBe(1)
      expect(row.lastWhitelistedAt).toBeNull()
    })

    it('should overwrite reason and reasonDetail to reflect latest event', async () => {
      // First event: complaint
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'COMPLAINT',
        reasonDetail: 'abuse',
      })
      // Subsequent event: permanent bounce overwrites
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
      })

      const row = await EmailSuppressionEntry.query().findOne({
        email: testEmail,
      })
      expect(row.reason).toBe('BOUNCE')
      expect(row.reasonDetail).toBe('NoEmail')
    })

    it('should reject invalid reason values via DB CHECK constraint', async () => {
      await expect(
        EmailSuppressionEntry.upsertSuppression({
          email: testEmail,
          reason: 'TRANSIENT' as never,
        }),
      ).rejects.toThrow()
    })
  })

  describe('getSuppressedEmails', () => {
    beforeEach(async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: 'suppressed@example.com',
        reason: 'BOUNCE',
      })
      await EmailSuppressionEntry.upsertSuppression({
        email: 'whitelisted@example.com',
        reason: 'BOUNCE',
      })
      await EmailSuppressionEntry.whitelistEmails(['whitelisted@example.com'])
    })

    it('should return only suppressed emails', async () => {
      const result = await EmailSuppressionEntry.getSuppressedEmails([
        'suppressed@example.com',
        'whitelisted@example.com',
        'unknown@example.com',
      ])
      expect(result).toEqual(['suppressed@example.com'])
    })

    it('should return empty array when no emails are suppressed', async () => {
      const result = await EmailSuppressionEntry.getSuppressedEmails([
        'whitelisted@example.com',
        'unknown@example.com',
      ])
      expect(result).toEqual([])
    })

    it('should return empty array for empty input', async () => {
      const result = await EmailSuppressionEntry.getSuppressedEmails([])
      expect(result).toEqual([])
    })
  })

  describe('whitelistEmails', () => {
    beforeEach(async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: 'suppressed@example.com',
        reason: 'BOUNCE',
      })
    })

    it('should whitelist a suppressed email and return it', async () => {
      const result = await EmailSuppressionEntry.whitelistEmails([
        'suppressed@example.com',
      ])
      expect(result).toEqual(['suppressed@example.com'])

      const row = await EmailSuppressionEntry.query().findOne({
        email: 'suppressed@example.com',
      })
      expect(row.lastWhitelistedAt).not.toBeNull()
    })

    it('should not return emails that are not suppressed or do not exist', async () => {
      const result = await EmailSuppressionEntry.whitelistEmails([
        'unknown@example.com',
      ])
      expect(result).toEqual([])
    })

    it('should not reset whitelist_count', async () => {
      await EmailSuppressionEntry.whitelistEmails(['suppressed@example.com'])
      await EmailSuppressionEntry.upsertSuppression({
        email: 'suppressed@example.com',
        reason: 'BOUNCE',
      })
      await EmailSuppressionEntry.whitelistEmails(['suppressed@example.com'])

      const row = await EmailSuppressionEntry.query().findOne({
        email: 'suppressed@example.com',
      })
      expect(row.whitelistCount).toBe(1)
      expect(row.lastWhitelistedAt).not.toBeNull()
    })

    it('should return empty array for empty input', async () => {
      const result = await EmailSuppressionEntry.whitelistEmails([])
      expect(result).toEqual([])
    })
  })
})
