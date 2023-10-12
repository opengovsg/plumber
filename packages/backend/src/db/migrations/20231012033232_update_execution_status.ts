import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.raw(`UPDATE executions as e SET status =
    (select status from execution_steps where execution_id = e.id and created_at = (
    select max(created_at) from execution_steps where execution_id = e.id)
  )`)
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.raw(`UPDATE executions SET status = null`)
}
