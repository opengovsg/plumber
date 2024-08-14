import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('template_steps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name').notNullable()
    table.string('app_key').nullable()
    table.string('event_key').nullable()
    table.integer('position').notNullable()
    table.jsonb('parameters').notNullable().defaultTo('{}')
    table.uuid('template_id').references('id').inTable('templates')

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })
  // add template steps for the pre-defined templates
  return await knex('template_steps').insert([
    // Template: Send follow ups
    {
      name: 'Send follow ups step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Send follow ups step 2',
      app_key: 'postman',
      event_key: 'sendTransactionalEmail',
      position: 2,
      parameters: {
        subject: 'Follow up',
        body: 'This is a sample body message',
      },
    },
    // Template: Send a copy of form response
    {
      name: 'Send a copy of form response step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Send a copy of form response step 2',
      app_key: 'postman',
      event_key: 'sendTransactionalEmail',
      position: 2,
    },
    // Template: Schedule reminders
    {
      name: 'Schedule reminders step 1',
      app_key: 'scheduler',
      event_key: 'everyHour',
      position: 1,
      parameters: { triggersOnWeekend: false },
    },
    {
      name: 'Schedule reminders step 2',
      app_key: 'postman',
      event_key: 'sendTransactionalEmail',
      position: 2,
    },
    // Template: Track feedback
    {
      name: 'Track feedback step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Track feedback step 2',
      app_key: 'tiles',
      event_key: 'createTileRow',
      position: 2,
    },
    // Template: Attendance taking
    {
      name: 'Attendance taking step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Attendance taking step 2',
      app_key: 'tiles',
      event_key: 'findSingleRow',
      position: 2,
    },
    {
      name: 'Attendance taking step 3',
      app_key: 'tiles',
      event_key: 'updateSingleRow',
      position: 3,
    },
    // Template: Update mailing list
    {
      name: 'Update mailing list step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Update mailing list step 2',
      app_key: 'tiles',
      event_key: 'findSingleRow',
      position: 2,
    },
    {
      name: 'Update mailing list step 3',
      app_key: 'tiles',
      event_key: 'updateSingleRow',
      position: 3,
    },
    // Template: Route support enquiries
    {
      name: 'Route support enquiries step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Route support enquiries step 2',
      app_key: 'toolbox',
      event_key: 'ifThen',
      position: 2,
      parameters: { depth: 0, branchName: 'Send email branch' },
    },
    {
      name: 'Route support enquiries step 3',
      app_key: 'postman',
      event_key: 'sendTransactionalEmail',
      position: 3,
    },
    {
      name: 'Route support enquiries step 4',
      app_key: 'toolbox',
      event_key: 'ifThen',
      position: 4,
      parameters: { depth: 0, branchName: 'Empty branch' },
    },
    {
      name: 'Route support enquiries step 5',
      position: 5,
    },
    // Template: Get live updates through Telegram
    {
      name: 'Get live updates through Telegram step 1',
      app_key: 'formsg',
      event_key: 'newSubmission',
      position: 1,
    },
    {
      name: 'Get live updates through Telegram step 2',
      app_key: 'telegram-bot',
      event_key: 'sendMessage',
      position: 2,
    },
    // Template: Send message to a Slack channel
    {
      name: 'Send message to a Slack channel step 1',
      app_key: 'scheduler',
      event_key: 'everyDay',
      position: 1,
      parameters: { hour: 18, triggersOnWeekend: true },
    },
    {
      name: 'Send message to a Slack channel step 2',
      app_key: 'slack',
      event_key: 'sendMessageToChannel',
      position: 2,
    },
  ])
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('template_steps')
}
