import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.string('key').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('execution_steps', (table) => {
    table.dropColumn('key')
  })
}
