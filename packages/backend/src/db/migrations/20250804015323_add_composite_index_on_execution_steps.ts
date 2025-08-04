import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('execution_steps', (table) => {
    table.index(['app_key', 'key'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('execution_steps', (table) => {
    table.dropIndex(['app_key', 'key'])
  })
}
