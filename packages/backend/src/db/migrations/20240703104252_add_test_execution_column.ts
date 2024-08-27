import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table
      .uuid('test_execution_id')
      .nullable()
      .references('id')
      .inTable('executions')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('flows', (table) => {
    table.dropColumn('test_execution_id')
  })
}
