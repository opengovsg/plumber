import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('table_collaborators', (table) => {
    table.primary(['user_id', 'table_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('table_collaborators', (table) => {
    table.dropPrimary()
  })
}
