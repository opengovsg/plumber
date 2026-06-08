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

    it('should undelete (reset deleted_at) when upserting onto a soft-deleted row', async () => {
      // Create then soft-delete the row.
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
      })
      await EmailSuppressionEntry.query().where({ email: testEmail }).delete()

      // Sanity: the row is now hidden from normal (soft-delete-filtered) queries.
      const hiddenBefore = await EmailSuppressionEntry.query().findOne({
        email: testEmail,
      })
      expect(hiddenBefore).toBeUndefined()

      // Re-suppression event for the same email should undelete + update it.
      await EmailSuppressionEntry.upsertSuppression({
        email: testEmail,
        reason: 'COMPLAINT',
        reasonDetail: 'abuse',
      })

      const row = await EmailSuppressionEntry.query().findOne({
        email: testEmail,
      })
      expect(row).toBeDefined()
      expect(row.deletedAt).toBeNull()
      expect(row.reason).toBe('COMPLAINT')
      expect(row.reasonDetail).toBe('abuse')
    })

    it('should reject invalid reason values via DB CHECK constraint', async () => {
      await expect(
        EmailSuppressionEntry.upsertSuppression({
          email: testEmail,
          reason: 'TRANSIENT' as never,
        }),
      ).rejects.toThrow()
    })

    it('should lowercase the email before storing', async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: 'MixedCase@Example.com',
        reason: 'BOUNCE',
      })

      const row = await EmailSuppressionEntry.query().findOne({
        email: 'mixedcase@example.com',
      })
      expect(row).toBeDefined()
      expect(row.email).toBe('mixedcase@example.com')
    })

    it('should treat differently-cased emails as the same row', async () => {
      await EmailSuppressionEntry.upsertSuppression({
        email: 'dupe@example.com',
        reason: 'BOUNCE',
        reasonDetail: 'NoEmail',
      })
      await EmailSuppressionEntry.upsertSuppression({
        email: 'DUPE@example.com',
        reason: 'COMPLAINT',
        reasonDetail: 'abuse',
      })

      const rows = await EmailSuppressionEntry.query().where({
        email: 'dupe@example.com',
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].reason).toBe('COMPLAINT')
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

    it('should match suppressed emails case-insensitively', async () => {
      const result = await EmailSuppressionEntry.getSuppressedEmails([
        'SUPPRESSED@Example.com',
      ])
      expect(result).toEqual(['suppressed@example.com'])
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

    it('should whitelist case-insensitively', async () => {
      const result = await EmailSuppressionEntry.whitelistEmails([
        'SUPPRESSED@Example.com',
      ])
      expect(result).toEqual(['suppressed@example.com'])

      const row = await EmailSuppressionEntry.query().findOne({
        email: 'suppressed@example.com',
      })
      expect(row.lastWhitelistedAt).not.toBeNull()
    })
  })
})
