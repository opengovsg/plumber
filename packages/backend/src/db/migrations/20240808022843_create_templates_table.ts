import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name').notNullable()
    table.string('description').notNullable()
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
  // add 9 pre-defined templates
  return await knex('templates').insert([
    {
      name: 'Send follow ups',
      description:
        'Send follow up emails to respondents after they submit a form',
    },
    {
      name: 'Send a copy of form response',
      description: 'Send respondents a copy of their form response',
    },
    {
      name: 'Schedule reminders',
      description:
        'Schedule a recurring reminder to yourself to complete a task everyday',
    },
    {
      name: 'Track feedback',
      description:
        'Store survey feedback in a table. Share this table with your team',
    },
    {
      name: 'Attendance taking',
      description: 'Track attendance for your event',
    },
    {
      name: 'Update mailing lists',
      description: 'Maintain mailing lists with updated recipient information',
    },
    {
      name: 'Route support enquiries',
      description: 'Route enquiries to the correct departments to process',
    },
    {
      name: 'Get live updates through Telegram',
      description:
        'Get updated on your operations quickly when you’re on the ground',
    },
    {
      name: 'Send message to a Slack channel',
      description: 'Schedule a recurring message to a Slack channel',
    },
  ])
  // TODO (mal): Thinking of using the template name as the unique key
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('templates')
}
