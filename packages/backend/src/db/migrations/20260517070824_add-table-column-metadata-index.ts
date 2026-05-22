import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('table_column_metadata', (table) => {
    table.index('table_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('table_column_metadata', (table) => {
    table.dropIndex('table_id')
  })
}
