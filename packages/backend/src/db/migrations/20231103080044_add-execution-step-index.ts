import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Add index for step_id in execution_steps table
  await knex.schema.table('execution_steps', (table) => {
    table.index('step_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('execution_steps', (table) => {
    table.dropIndex('step_id')
  })
}
