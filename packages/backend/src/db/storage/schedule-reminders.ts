import type { ITemplate } from '@plumber/types'

import { USER_EMAIL_PLACEHOLDER } from './constants'

const SCHEDULE_REMINDERS_ID = '65e90f41-b605-4e83-bcd7-e4d2e349299d'

export const SCHEDULE_REMINDERS_TEMPLATE: ITemplate = {
  id: SCHEDULE_REMINDERS_ID,
  name: 'Schedule reminders',
  description:
    'Schedule a recurring reminder to yourself to complete a task weekly',
  iconName: 'BiCalendar',
  tags: ['empty'],
  // Steps: scheduler --> postman
  steps: [
    {
      position: 1,
      appKey: 'scheduler',
      eventKey: 'everyWeek',
      parameters: { hour: '9', weekday: '1' },
    },
    {
      position: 2,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      parameters: {
        body: '<p style="margin: 0">This is a scheduled reminder to do you best this week! </p>',
        subject: "It's a new week!",
        senderName: 'Weekly motivation',
        destinationEmail: USER_EMAIL_PLACEHOLDER,
      },
    },
  ],
}
