import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('login_whitelist', (table) => {
    table.string('value').primary().notNullable()
    table.string('type').notNullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('login_whitelist')
}
