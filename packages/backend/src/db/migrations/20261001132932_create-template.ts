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

  await knex.schema.alterTable('steps', (table) => {
    table.uuid('template_id').references('id').inTable('templates').nullable()
    table.index('template_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('steps', (table) => {
    table.dropColumn('template_id')
  })
  await knex.schema.dropTable('templates')
}
