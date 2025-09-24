import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flow_connections', (table) => {
    table.uuid('flow_id').references('id').inTable('flows').notNullable()
    // NOTE: this connection_id refers to either:
    // - the connection id of a connection in the connections table; OR
    // - the id of a Tile
    table.uuid('connection_id').notNullable()
    // NOTE: addedBy is the user id of the user who added the connection to the flow
    table.uuid('added_by').references('id').inTable('users').notNullable()
    table.enu('connection_type', ['connection', 'table']).notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
    table.jsonb('metadata').notNullable().defaultTo('{}')

    // use the unique constraint to avoid duplicates
    table.unique(['flow_id', 'connection_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('flow_connections')
}
