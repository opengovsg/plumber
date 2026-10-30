import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.timestamp('migration_started_at', { useTz: true }).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_metadata', (table) => {
    table.dropColumn('migration_started_at')
  })
}
