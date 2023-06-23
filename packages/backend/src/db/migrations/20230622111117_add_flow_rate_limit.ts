import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.integer('max_qps').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.dropColumn('max_qps')
  })
}
