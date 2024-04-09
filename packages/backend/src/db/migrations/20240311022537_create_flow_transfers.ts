import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flow_transfers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('flow_id').references('id').inTable('flows').notNullable()
    table.uuid('old_owner_id').references('id').inTable('users').notNullable()
    table.uuid('new_owner_id').references('id').inTable('users').notNullable()
    table.string('status').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('flow_transfers')
}
