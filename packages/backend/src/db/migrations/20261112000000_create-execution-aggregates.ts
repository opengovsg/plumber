import { Knex } from 'knex'

/**
 * Daily execution counts that outlive archival, which deletes executions and their steps.
 *
 * No foreign keys, so a count stays when its pipe, step or owner goes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('execution_daily', (table) => {
    table.date('day').notNullable()
    table.uuid('flow_id').notNullable()
    table.uuid('owner_user_id').nullable()
    table.boolean('test_run').notNullable()
    table.string('status').nullable()
    table.string('duration_bucket').notNullable()
    table.integer('count').notNullable()
    table.check(
      "duration_bucket IN ('under_1m', 'under_1h', 'under_1d', 'under_7d', '7d_plus')",
    )
    table.check('count > 0')
  })

  await knex.schema.createTable('execution_step_daily', (table) => {
    table.date('day').notNullable()
    table.uuid('flow_id').notNullable()
    table.uuid('step_id').nullable()
    table.uuid('owner_user_id').nullable()
    table.string('app_key').nullable()
    table.string('action_key').nullable()
    table.boolean('test_run').notNullable()
    table.string('status').nullable()
    table.string('error_kind').nullable()
    table.integer('count').notNullable()
    table.check('count > 0')
  })

  // A test run has no status, so null must match null or a rerun duplicates the day.
  // flow_id and day lead each key, so it also serves a search by pipe.
  await knex.raw(`
    ALTER TABLE execution_daily ADD CONSTRAINT execution_daily_key
      UNIQUE NULLS NOT DISTINCT (flow_id, day, test_run, status, duration_bucket)
  `)
  await knex.raw(`
    ALTER TABLE execution_step_daily ADD CONSTRAINT execution_step_daily_key
      UNIQUE NULLS NOT DISTINCT
      (flow_id, day, step_id, app_key, action_key, test_run, status, error_kind)
  `)

  await knex.schema.createTable('analytics_watermark', (table) => {
    table.string('name').primary()
    table.date('last_completed_day').notNullable()
    table.timestamp('updated_at', { useTz: true }).notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('analytics_watermark')
  await knex.schema.dropTable('execution_step_daily')
  await knex.schema.dropTable('execution_daily')
}
