import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS execution_steps_app_key_key_index ON execution_steps (app_key, key)',
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'DROP INDEX CONCURRENTLY IF EXISTS execution_steps_app_key_key_index',
  )
}

export const config = { transaction: false }
