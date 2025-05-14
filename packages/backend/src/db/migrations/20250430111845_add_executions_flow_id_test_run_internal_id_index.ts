import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Add index for flow_id, test_run, internal_id in executions table
  await knex.schema.table('executions', (table) => {
    table.index(['flow_id', 'test_run', 'internal_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('executions', (table) => {
    table.dropIndex(['flow_id', 'test_run', 'internal_id'])
  })
}
