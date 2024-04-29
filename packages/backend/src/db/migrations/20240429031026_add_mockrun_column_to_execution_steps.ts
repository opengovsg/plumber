import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.boolean('mock_run').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.dropColumn('mock_run')
  })
}
