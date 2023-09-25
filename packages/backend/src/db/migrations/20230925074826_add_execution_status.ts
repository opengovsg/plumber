import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // pending status for delays...
  await knex.schema.table('executions', (table) => {
    table.string('status').defaultTo('pending')
  })
  return knex.schema.raw(`UPDATE executions as e SET status = 
    (select status from execution_steps where execution_id = e.id and created_at = (
  select max(created_at) from execution_steps where execution_id = e.id)
  )`)
}
export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('executions', (table) => {
    table.dropColumn('status')
  })
}
