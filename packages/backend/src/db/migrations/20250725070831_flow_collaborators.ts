import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flow_collaborators', (table) => {
    table.uuid('flow_id').references('id').inTable('flows').notNullable()
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table.string('role').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
    table.timestamp('last_accessed_at').notNullable().defaultTo(knex.fn.now())
    table.uuid('updated_by').references('id').inTable('users').notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('flow_collaborators')
}
