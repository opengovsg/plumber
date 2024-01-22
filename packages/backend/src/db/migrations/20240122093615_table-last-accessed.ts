import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.timestamp('accessed_at').notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.dropColumn('accessed_at')
  })
}
