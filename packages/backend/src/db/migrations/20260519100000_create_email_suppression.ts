import { Knex } from 'knex'

/**
 * email_suppression stores emails that should not be sent to via SES.
 *
 * Only two kinds of events lead to a row here:
 *  - reason='BOUNCE'    -> permanent SES bounces (transient bounces are ignored)
 *  - reason='COMPLAINT' -> SES complaints (except 'not-spam', which whitelists)
 *
 * reason_detail is optional sub-classification for triage / debugging only:
 *  - For BOUNCE: SES bounceSubType (e.g. 'NoEmail', 'General', 'Suppressed')
 *  - For COMPLAINT: SES complaintFeedbackType (e.g. 'abuse', 'fraud', 'virus')
 *
 * deleted_at exists for consistency with the project-wide soft-delete
 * convention (see Base model + ExtendedQueryBuilder) and is expected to
 * stay NULL — no code path here soft-deletes suppression rows. The upsert
 * resets it defensively in case a future cleanup script ever does.
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('email_suppression', (table) => {
    // email is the natural primary key — there is exactly one suppression row
    // per address and every access path looks up by email. .primary() implies
    // NOT NULL + UNIQUE, so no separate unique constraint is needed.
    table.string('email', 255).primary()
    table.string('reason', 20).notNullable()
    table.string('reason_detail', 50).nullable()
    table.string('ses_message_id', 255).nullable()
    table.integer('whitelist_count').notNullable().defaultTo(0)
    table.timestamp('last_whitelisted_at', { useTz: true }).nullable()
    table.timestamp('deleted_at', { useTz: true }).nullable()
    table.timestamps(true, true) // created_at, updated_at with defaults

    // Enforce the invariant at the DB layer — transient bounces and
    // unknown event types must never end up in this table.
    table.check("reason IN ('BOUNCE', 'COMPLAINT')")
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('email_suppression')
}
