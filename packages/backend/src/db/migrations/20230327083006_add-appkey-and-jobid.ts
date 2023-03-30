import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.string('app_key')
    table.string('job_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.dropColumns('app_key', 'job_id')
  })
}
