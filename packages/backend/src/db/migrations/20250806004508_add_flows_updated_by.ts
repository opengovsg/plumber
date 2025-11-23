import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.uuid('updated_by').references('id').inTable('users').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.dropColumn('updated_by')
  })
}
