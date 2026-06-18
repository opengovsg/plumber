import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table.integer('archived_execution_count').notNullable().defaultTo(0)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table.dropColumn('archived_execution_count')
  })
}
