import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flow_connections', (table) => {
    table.uuid('flow_id').references('id').inTable('flows').notNullable()
    // do not reference connections table as Tiles does not have a connection id
    table.uuid('connection_id').notNullable()
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
    table.jsonb('metadata').notNullable().defaultTo('{}')

    // use the unique constraint to avoid duplicates
    table.unique(['flow_id', 'connection_id', 'user_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('flow_connections')
}
