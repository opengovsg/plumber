import { raw } from 'objection'

import Base from './base'

/**
 * The kind of SES event that caused a suppression.
 *
 * Only these two reach the table:
 *  - BOUNCE    -> SES Bounce event with bounceType='Permanent'
 *  - COMPLAINT -> SES Complaint event (any feedback type except 'not-spam')
 *
 * Transient/Undetermined bounces and 'not-spam' complaints never produce
 * a row: transient bounces are logged-only, and 'not-spam' triggers an
 * auto-whitelist instead of suppression.
 */
export type SuppressionReason = 'BOUNCE' | 'COMPLAINT'

/**
 * Allowed (reason, reasonDetail) pairings — for documentation only.
 *
 * BOUNCE:
 *  - 'NoEmail'                  email address does not exist
 *  - 'General'                  generic permanent failure
 *  - 'Suppressed'               on SES account-level suppression list
 *  - 'OnAccountSuppressionList' same as Suppressed (older naming)
 *
 * COMPLAINT:
 *  - 'abuse'                    marked as spam
 *  - 'fraud'                    reported as fraud
 *  - 'virus'                    reported as virus
 *  - 'other'                    unspecified
 *
 * reasonDetail is informational only — suppression checks only look at the
 * row's existence + last_whitelisted_at, never at reason/reasonDetail.
 */

class EmailSuppressionEntry extends Base {
  id!: string
  email!: string
  reason!: SuppressionReason
  reasonDetail?: string
  sesMessageId?: string
  whitelistCount!: number
  lastWhitelistedAt?: string

  static tableName = 'email_suppression'

  static jsonSchema = {
    type: 'object',
    required: ['email', 'reason'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', maxLength: 255 },
      reason: { type: 'string', enum: ['BOUNCE', 'COMPLAINT'] },
      reasonDetail: { type: ['string', 'null'], maxLength: 50 },
      sesMessageId: { type: ['string', 'null'], maxLength: 255 },
      whitelistCount: { type: 'integer' },
      lastWhitelistedAt: {
        type: ['string', 'null'],
        format: 'date-time',
      },
    },
  }

  /**
   * Upsert a suppression record from an SES bounce/complaint event.
   *
   * Two paths:
   *   1. New email -> insert a fresh row (whitelist_count = 0, suppressed)
   *   2. Existing email (conflict on UNIQUE(email)) -> update existing row
   *
   * On conflict:
   *   - Overwrites reason / reason_detail / ses_message_id with latest event
   *   - Re-suppresses the row (last_whitelisted_at = NULL)
   *   - Increments whitelist_count ONLY if the email was whitelisted before
   *     this event — a signal that an admin's whitelist decision was wrong
   *   - Resets deleted_at so a previously soft-deleted row becomes visible
   *     to the suppression check again
   *
   * Idempotent: safe to call multiple times for the same event.
   */
  static async upsertSuppression(params: {
    email: string
    reason: SuppressionReason
    reasonDetail?: string
    sesMessageId?: string
  }): Promise<void> {
    const { email, reason, reasonDetail, sesMessageId } = params

    await this.query()
      .insert({
        email,
        reason,
        reasonDetail: reasonDetail ?? null,
        sesMessageId: sesMessageId ?? null,
        whitelistCount: 0,
        lastWhitelistedAt: null,
      })
      .onConflict('email')
      .merge({
        reason,
        reasonDetail: reasonDetail ?? null,
        sesMessageId: sesMessageId ?? null,
        lastWhitelistedAt: null,
        // increment only when re-suppressing a previously whitelisted email
        whitelistCount: raw(
          `CASE
            WHEN email_suppression.last_whitelisted_at IS NOT NULL
            THEN email_suppression.whitelist_count + 1
            ELSE email_suppression.whitelist_count
          END`,
        ),
        // undelete: re-suppression should always be visible to suppression checks
        deletedAt: null,
      })
  }

  /**
   * Check which emails from a list are currently suppressed.
   * An email is suppressed if it exists in the table AND last_whitelisted_at IS NULL.
   *
   * Returns the subset of input emails that are suppressed.
   */
  static async getSuppressedEmails(emails: string[]): Promise<string[]> {
    if (emails.length === 0) {
      return []
    }

    const results = await this.query()
      .select('email')
      .whereIn('email', emails)
      .whereNull('last_whitelisted_at')

    return results.map((row) => row.email)
  }

  /**
   * Whitelist one or more emails (admin force-whitelist).
   * Sets last_whitelisted_at = now() for emails that are currently suppressed.
   * Does NOT reset whitelist_count.
   *
   * Returns the list of emails that were actually whitelisted
   * (i.e. were suppressed and are now whitelisted).
   */
  static async whitelistEmails(emails: string[]): Promise<string[]> {
    if (emails.length === 0) {
      return []
    }

    const results = await this.query()
      .patch({
        lastWhitelistedAt: new Date().toISOString(),
      })
      .whereIn('email', emails)
      .whereNull('last_whitelisted_at')
      .returning('email')

    return results.map((row) => row.email)
  }
}

export default EmailSuppressionEntry
