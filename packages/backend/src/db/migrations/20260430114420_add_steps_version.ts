import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('steps', (table) => {
    table.integer('version').notNullable().defaultTo(1)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('steps', (table) => {
    table.dropColumn('version')
  })
}
