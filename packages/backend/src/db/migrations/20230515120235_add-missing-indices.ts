import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Add index for execution_id foreign key in execution_steps table
  await knex.schema.table('execution_steps', (table) => {
    table.index('execution_id')
  })
  // Add index for key foreign key in connections table
  await knex.schema.table('connections', (table) => {
    table.index('key')
  })
  // Add index for user_id fk in flow tables
  await knex.schema.table('flows', (table) => {
    table.index('user_id')
  })
  // Add index for flow_id fk in executions table
  await knex.schema.table('executions', (table) => {
    table.index('flow_id')
  })
  // Add index for flow_id fk in steps table
  await knex.schema.table('steps', (table) => {
    table.index('flow_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('execution_steps', (table) => {
    table.dropIndex('execution_id')
  })
  await knex.schema.table('connections', (table) => {
    table.dropIndex('key')
  })
  await knex.schema.table('flows', (table) => {
    table.dropIndex('user_id')
  })
  await knex.schema.table('executions', (table) => {
    table.dropIndex('flow_id')
  })
  await knex.schema.table('steps', (table) => {
    table.dropIndex('flow_id')
  })
}
