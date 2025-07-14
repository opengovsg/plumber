import type { ITemplate } from '@plumber/types'

import {
  CREATE_TEMPLATE_STEP_VARIABLE,
  TILE_COL_DATA_PLACEHOLDER,
  TILE_ID_PLACEHOLDER,
  USER_EMAIL_PLACEHOLDER,
} from './constants'

const FOR_EACH_REMINDER_ID = 'b8dd6c22-3578-460d-89e2-e2062b3601f2'

export const FOR_EACH_REMINDER_TEMPLATE: ITemplate = {
  id: FOR_EACH_REMINDER_ID,
  name: 'Schedule reminders to a list of emails',
  description: 'Schedule a recurring reminder to a group of people',
  iconName: 'BiCalendar',
  tags: ['new'],
  // Steps: scheduler --> tiles --> for-each --> postman --> tiles
  steps: [
    {
      position: 1,
      appKey: 'scheduler',
      eventKey: 'everyDay',
      parameters: { hour: '10', triggersOnWeekend: false },
    },
    {
      position: 2,
      appKey: 'tiles',
      eventKey: 'findMultipleRows',
      parameters: {
        tableId: TILE_ID_PLACEHOLDER,
        filters: [
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('RSVPed'),
            value: 'Yes',
            operator: 'equals',
          },
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Reminder sent'),
            operator: 'empty',
          },
        ],
        returnLastRowFirst: true,
      },
    },
    {
      position: 3,
      appKey: 'toolbox',
      eventKey: 'forEach',
      parameters: {
        items: CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace with rows data from step 2',
          2,
        ),
      },
    },
    {
      position: 4,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      parameters: {
        body: '<p style="margin: 0">This is a gentle reminder for the upcoming event! </p>',
        subject: 'Event reminder',
        senderName: 'Event reminder',
        destinationEmail: USER_EMAIL_PLACEHOLDER,
      },
    },
    {
      position: 5,
      appKey: 'tiles',
      eventKey: 'updateSingleRow',
      parameters: {
        tableId: TILE_ID_PLACEHOLDER,
        rowId: CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace with Row ID from Step 3',
          3,
        ),
        rowData: [
          {
            columnId: TILE_COL_DATA_PLACEHOLDER('Reminder sent'),
            cellValue: 'Yes',
          },
        ],
      },
    },
  ],
  tileTemplateData: {
    name: 'Event Sign ups',
    columns: ['Name', 'Email', 'Mobile number', 'RSVPed', 'Reminder sent'],
    rowData: [
      {
        Name: 'Anna Lee',
        Email: 'anna_lee@email.com',
        'Mobile number': '+6598625072',
        RSVPed: 'Yes',
      },
      {
        Name: 'Susan Tan Jia Ling',
        Email: 'susan_tjl@email.com',
      },
      {
        Name: 'Jane Lim',
        Email: 'jane_98@email.com',
        RSVPed: 'Yes',
      },
      {
        Name: 'Amy Low',
        Email: 'amy_low_ll@email.com',
        RSVPed: 'Yes',
      },
      {
        Name: 'Judy Ng',
        Email: 'judy_00@email.com',
      },
    ],
  },
}
