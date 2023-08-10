import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('table_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').references('id').inTable('users')
    table.string('name')
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
  await knex.schema.createTable('table_column_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('table_id').references('id').inTable('table_metadata')
    table.string('name')
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('table_column_metadata')
  await knex.schema.dropTable('table_metadata')
}
