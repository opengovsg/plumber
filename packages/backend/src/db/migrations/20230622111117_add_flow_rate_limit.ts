import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.jsonb('rate_limit_config').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('flows', (table) => {
    table.dropColumn('rate_limit_config')
  })
}
