import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table.uuid('template_id').nullable().references('id').inTable('templates')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table.dropColumn('template_id')
  })
}
