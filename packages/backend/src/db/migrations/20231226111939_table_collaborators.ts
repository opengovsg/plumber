import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('table_metadata', (table) => {
    table.dropColumn('user_id')
  })
  await knex.schema.createTable('table_collaborators', (table) => {
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table
      .uuid('table_id')
      .references('id')
      .inTable('table_metadata')
      .notNullable()
    table.string('role').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('table_metadata', (table) => {
    // set to nullable first, or else it'll fail without default values
    table.uuid('user_id').references('id').inTable('users').nullable()
  })
  await knex.schema.dropTable('table_collaborators')
}
