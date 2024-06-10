import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('app_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('app_key').notNullable()
    table.string('metadata_type').notNullable()
    table.jsonb('metadata').notNullable()
    table.index(['app_key', 'metadata_type'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('app_metadata')
}
