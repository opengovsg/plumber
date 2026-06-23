import type { ModelOptions, QueryContext } from 'objection'
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
  email!: string
  reason!: SuppressionReason
  reasonDetail?: string
  sesMessageId?: string
  whitelistCount!: number
  lastWhitelistedAt?: string

  static tableName = 'email_suppression'

  // email is the primary key (no surrogate id column). Objection defaults
  // idColumn to 'id', so this must be set explicitly or instance operations
  // (e.g. $query(), $id()) would target a non-existent column.
  static idColumn = 'email'

  static jsonSchema = {
    type: 'object',
    required: ['email', 'reason'],

    properties: {
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

  // Lowercase email on write so stored rows have a canonical casing.
  // Suppression matching must be case-insensitive — the read methods below
  // lowercase their inputs to match. (Email parsing elsewhere in the codebase
  // already lowercases, e.g. recipient parsing + the dataOut schema.)
  async $beforeInsert(queryContext: QueryContext): Promise<void> {
    await super.$beforeInsert(queryContext)
    if (this.email) {
      this.email = this.email.toLowerCase()
    }
  }

  async $beforeUpdate(
    opts: ModelOptions,
    queryContext: QueryContext,
  ): Promise<void> {
    await super.$beforeUpdate(opts, queryContext)
    // `email` is absent on patches that don't touch it (e.g. whitelistEmails).
    if (this.email) {
      this.email = this.email.toLowerCase()
    }
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
   *   - Leaves whitelist_count untouched — it counts successful whitelists
   *     (incremented in whitelistEmails), not re-suppressions
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
      // Safeguard because deleted_at should always be null:
      // The base query builder appends `deleted_at IS NULL` to every query,
      // which would otherwise land on the ON CONFLICT ... DO UPDATE clause and
      // skip the merge for a soft-deleted row — leaving it deleted instead of
      // re-suppressed. withSoftDeleted() drops that filter so the upsert can
      // undelete (reset deleted_at below).
      .withSoftDeleted()
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
        updatedAt: new Date().toISOString(),
        // whitelist_count is intentionally not updated here — it tracks
        // successful whitelists (see whitelistEmails), not re-suppressions.
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
    const lowercasedEmails = emails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)

    if (lowercasedEmails.length === 0) {
      return []
    }

    const results = await this.query()
      .select('email')
      .whereIn('email', lowercasedEmails)
      .whereNull('last_whitelisted_at')

    return results.map((row) => row.email)
  }

  /**
   * Whitelist one or more emails (admin force-whitelist).
   * Sets last_whitelisted_at = now() for emails that are currently suppressed,
   * and increments whitelist_count once per suppressed -> whitelisted
   * transition (already-whitelisted emails are skipped by the WHERE clause, so
   * the count is not double-incremented).
   *
   * Returns the list of emails that were actually whitelisted
   * (i.e. were suppressed and are now whitelisted).
   */
  static async whitelistEmails(emails: string[]): Promise<string[]> {
    if (emails.length === 0) {
      return []
    }

    const lowercasedEmails = emails.map((email) => email.toLowerCase())
    const results = await this.query()
      .patch({
        lastWhitelistedAt: new Date().toISOString(),
        whitelistCount: raw('whitelist_count + 1'),
      })
      .whereIn('email', lowercasedEmails)
      .whereNull('last_whitelisted_at')
      .returning('email')

    return results.map((row) => row.email)
  }
}

export default EmailSuppressionEntry
