import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('steps', (table) => {
    table.jsonb('config').notNullable().defaultTo('{}')
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('steps', (table) => {
    table.dropColumn('config')
  })
}
