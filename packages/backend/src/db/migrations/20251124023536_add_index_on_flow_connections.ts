import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('flow_connections', (table) => {
    table.index(['connection_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('flow_connections', (table) => {
    table.dropIndex(['connection_id'])
  })
}
