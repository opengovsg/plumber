import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('executions', (table) => {
    table.jsonb('app_data').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('executions', (table) => {
    table.dropColumn('app_data')
  })
}
