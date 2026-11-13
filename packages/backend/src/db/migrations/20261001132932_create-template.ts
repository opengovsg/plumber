import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name').notNullable()
    table.text('description').notNullable().defaultTo('')
    table.uuid('user_id').references('id').inTable('users').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('user_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('templates')
}
