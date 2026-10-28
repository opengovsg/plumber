import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('template_steps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('template_id')
      .references('id')
      .inTable('templates')
      .notNullable()
      .onDelete('CASCADE')
    table.jsonb('data').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('template_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('template_steps')
}
