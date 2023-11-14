import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('table_column_metadata', (table) => {
    table.unique(['table_id', 'position'])
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_column_metadata', (table) => {
    table.dropUnique(['table_id', 'position'])
  })
}
