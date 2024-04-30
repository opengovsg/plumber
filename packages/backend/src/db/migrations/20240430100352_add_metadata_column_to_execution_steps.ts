import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.jsonb('metadata').notNullable().defaultTo('{}')
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.dropColumn('metadata')
  })
}
