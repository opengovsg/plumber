import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('users', (table) => {
    table.timestamp('last_login_at').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('users', (table) => {
    table.dropColumn('last_login_at')
  })
}
