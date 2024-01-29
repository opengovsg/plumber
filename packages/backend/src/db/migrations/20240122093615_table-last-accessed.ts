import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('table_collaborators', (table) => {
    table.timestamp('last_accessed_at').notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('table_collaborators', (table) => {
    table.dropColumn('last_accessed_at')
  })
}
