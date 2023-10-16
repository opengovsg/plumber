import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('executions', (table) => {
    table.string('status').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('executions', (table) => {
    table.dropColumn('status')
  })
}
