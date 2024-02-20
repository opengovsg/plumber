import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.string('view_only_key').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.dropColumn('view_only_key')
  })
}
