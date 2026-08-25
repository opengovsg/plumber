import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flow_folders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table.string('name').notNullable()
    table.string('color').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('user_id')
  })

  await knex.schema.createTable('flow_folder_items', (table) => {
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table.uuid('flow_id').references('id').inTable('flows').notNullable()
    table
      .uuid('folder_id')
      .references('id')
      .inTable('flow_folders')
      .notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    // use the primary key constraint to enforce one folder per pipe per user
    table.primary(['user_id', 'flow_id'])
    table.index('folder_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('flow_folder_items')
  await knex.schema.dropTable('flow_folders')
}
