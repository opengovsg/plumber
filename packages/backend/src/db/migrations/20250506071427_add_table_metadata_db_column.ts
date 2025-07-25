import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('table_metadata', (table) => {
    table.string('db').defaultTo('ddb').notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('table_metadata', (table) => {
    table.dropColumn('db')
  })
}
