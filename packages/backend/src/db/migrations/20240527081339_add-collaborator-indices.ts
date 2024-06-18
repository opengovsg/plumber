import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('table_collaborators', (table) => {
    table.index('user_id')
    table.index('table_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('table_collaborators', (table) => {
    table.dropIndex('user_id')
    table.dropIndex('table_id')
  })
}
