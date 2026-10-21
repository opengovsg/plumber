import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.jsonb('config').notNullable().defaultTo('{}')
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.dropColumn('config')
  })
}
