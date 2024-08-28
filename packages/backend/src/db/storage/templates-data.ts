import { Template } from '@/graphql/__generated__/types.generated'

const SEND_FOLLOW_UPS_ID = 'aae185f7-2592-4683-a812-2d412232e403'
const SEND_A_COPY_OF_FORM_RESPONSE_ID = 'd06d1024-2f1d-46ca-b9b3-2d3d073eddfe'
const SCHEDULE_REMINDERS_ID = '65e90f41-b605-4e83-bcd7-e4d2e349299d'
const TRACK_FEEDBACK_ID = 'b237ff81-dbe9-4513-8135-0b59eec2de97'
const ATTENDANCE_TAKING_ID = '04f95a37-46fe-455b-aa96-28c421379e1a'
const UPDATE_MAILING_LISTS_ID = '8ec2728a-6e4a-49c7-8721-ef6d4eb1d946'
const ROUTE_SUPPORT_ENQUIRIES_ID = '2a84e2f6-4806-46a2-890a-0dba1411b12f'
const GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID =
  '9c964678-8e24-440e-b2fd-b42da4dea4b1'
const SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID =
  'c88d03f7-862b-45e5-8a51-33e293236bd8'

// Helper function to ensure templates cannot be modified
function deepFreeze<T>(object: T): T {
  if (Array.isArray(object)) {
    object.forEach(deepFreeze)
  } else {
    // Freeze each property if it is an object
    Object.getOwnPropertyNames(object).forEach((name) => {
      const value = (object as any)[name]
      if (value && typeof value === 'object') {
        deepFreeze(value)
      }
    })
  }
  return Object.freeze(object)
}

/**
 * Note that parameters will have {{Replace with __}}, these are
 * placeholders for users to change them to the variable pills
 */
export const TEMPLATES: Template[] = deepFreeze<Template[]>([
  // Template: Send follow ups
  {
    id: SEND_FOLLOW_UPS_ID,
    name: 'Send follow ups',
    description:
      'Send follow up emails to respondents after they submit a form',
    // Steps: formsg --> postman
    steps: [
      {
        position: 1,
        templateId: SEND_FOLLOW_UPS_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2bb59c28ac9d16c1b62c9',
      },
      {
        position: 2,
        templateId: SEND_FOLLOW_UPS_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        parameters: {
          body: '<p style="margin: 0">Hi {{Replace with response 1 name}},</p><p style="margin: 0"></p><p style="margin: 0">We have received your registration for this event! More details will be sent to you nearer to the event date.</p><p style="margin: 0"></p><p style="margin: 0">Cheers,</p><p style="margin: 0">Event organising committee</p>',
          subject: 'Thank you for registering!',
          senderName: 'Event committee',
          destinationEmail: '{{Replace with response 2 email}}',
        },
      },
    ],
  },
  // Template: Send a copy of form response
  {
    id: SEND_A_COPY_OF_FORM_RESPONSE_ID,
    name: 'Send a copy of form response',
    description: 'Send respondents a copy of their form response',
    // Steps: formsg --> postman
    steps: [
      {
        position: 1,
        templateId: SEND_A_COPY_OF_FORM_RESPONSE_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2bb59c28ac9d16c1b62c9',
      },
      {
        position: 2,
        templateId: SEND_A_COPY_OF_FORM_RESPONSE_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        parameters: {
          body: '<p style="margin: 0">Hi <span data-type="variable" data-id="Replace with response 1 name" data-label="Replace with response 1 name">{{Replace with response 1 name}}</span>,</p><p style="margin: 0"></p><p style="margin: 0">We have received your registration, here is what you submitted:</p><p style="margin: 0"></p><table style="border-collapse:collapse;"><tbody><tr><td style="border:1px solid black;padding: 5px 10px;min-width: 100px;height: 15px;" colspan="1" rowspan="1"><p style="margin: 0">Question</p></td><td style="border:1px solid black;padding: 5px 10px;min-width: 100px;height: 15px;" colspan="1" rowspan="1"><p style="margin: 0">Response</p></td></tr><tr><td style="border:1px solid black;padding: 5px 10px;min-width: 100px;height: 15px;" colspan="1" rowspan="1"><p style="margin: 0">{{Replace with question}}</p></td><td style="border:1px solid black;padding: 5px 10px;min-width: 100px;height: 15px;" colspan="1" rowspan="1"><p style="margin: 0">{{Replace with response}}</p></td></tr></tbody></table><p style="margin: 0"></p><p style="margin: 0">More details will be sent to you nearer to the date.</p><p style="margin: 0"></p><p style="margin: 0">Cheers,</p><p style="margin: 0">Event committee</p>',
          subject: 'We have received your registration!',
          senderName: 'Event committee',
          destinationEmail: '{{Replace with response 2 email}}',
        },
      },
    ],
  },
  // Template: Schedule reminders
  {
    id: SCHEDULE_REMINDERS_ID,
    name: 'Schedule reminders',
    description:
      'Schedule a recurring reminder to yourself to complete a task everyday',
    // Steps: scheduler --> postman
    steps: [
      {
        position: 1,
        templateId: SCHEDULE_REMINDERS_ID,
        appKey: 'scheduler',
        eventKey: 'everyWeek',
        parameters: { hour: '9', weekday: '1' },
      },
      {
        position: 2,
        templateId: SCHEDULE_REMINDERS_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        parameters: {
          body: '<p style="margin: 0">This is a scheduled reminder to do you best this week! </p>',
          subject: "It's a new week!",
          senderName: 'Weekly motivation',
          destinationEmail: '{{user_email}}',
        },
      },
    ],
  },
  // Template: Track feedback
  {
    id: TRACK_FEEDBACK_ID,
    name: 'Track feedback',
    description:
      'Store survey feedback in a table. Share this table with your team.',
    // Steps: formsg --> create tile
    steps: [
      {
        position: 1,
        templateId: TRACK_FEEDBACK_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2d2ea69c2121a425975bc',
      },
      {
        position: 2,
        templateId: TRACK_FEEDBACK_ID,
        appKey: 'tiles',
        eventKey: 'createTileRow',
        sampleUrl:
          'https://plumber.gov.sg/tiles/18a72737-4a7e-4f90-8bb5-7d65bdac4136/d6f806c0-eb80-451b-872d-6e9a3d434ab2',
      },
    ],
  },
  // Template: Attendance taking
  {
    id: ATTENDANCE_TAKING_ID,
    name: 'Attendance taking',
    description: 'Track attendance for your event',
    // Steps: formsg --> find tile row --> update tile row
    steps: [
      {
        position: 1,
        templateId: ATTENDANCE_TAKING_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2c58c0ebf8abcb0ad4c76',
      },
      {
        position: 2,
        templateId: ATTENDANCE_TAKING_ID,
        appKey: 'tiles',
        eventKey: 'findSingleRow',
        sampleUrl:
          'https://plumber.gov.sg/tiles/c77bc8fc-e1ca-4300-a50d-7f2933b9e5b4/a4ca3902-f0ef-41e1-9f5d-45c602c04d50',
      },
      {
        position: 3,
        templateId: ATTENDANCE_TAKING_ID,
        appKey: 'tiles',
        eventKey: 'updateSingleRow',
      },
    ],
  },
  // Template: Update mailing list
  {
    id: UPDATE_MAILING_LISTS_ID,
    name: 'Update mailing lists',
    description: 'Maintain mailing lists with updated recipient information',
    // Steps: formsg --> find tile row --> update tile row
    steps: [
      {
        position: 1,
        templateId: UPDATE_MAILING_LISTS_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2cf038ff0ca00daca1c6f',
      },
      {
        position: 2,
        templateId: UPDATE_MAILING_LISTS_ID,
        appKey: 'tiles',
        eventKey: 'findSingleRow',
        sampleUrl:
          'https://plumber.gov.sg/tiles/ba2150f6-14d5-44cf-8a77-083c18f43518/c6b75dfa-9fa9-494c-b027-773da38ebaff',
      },
      {
        position: 3,
        templateId: UPDATE_MAILING_LISTS_ID,
        appKey: 'tiles',
        eventKey: 'updateSingleRow',
      },
    ],
  },
  // Template: Route support enquiries
  {
    id: ROUTE_SUPPORT_ENQUIRIES_ID,
    name: 'Route support enquiries',
    description: 'Route enquiries to the correct departments to process',
    // Steps: formsg --> if-then to 4 branches
    steps: [
      {
        position: 1,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2d127c61aa529969562c6',
      },
      {
        position: 2,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: {
          depth: 0,
          branchName: 'Resetting device',
          conditions: [
            {
              is: 'is',
              text: 'Resetting device',
              field: '{{Replace with response 1 request}}',
              condition: 'equals',
            },
          ],
        },
      },
      {
        position: 3,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        parameters: {
          body: '<p style="margin: 0">You have received a support request from {{Replace with response 3 name}}! </p><p style="margin: 0"></p><p style="margin: 0">Here is what their request is about: </p><p style="margin: 0">{{Replace with response 2 description}}</p><p style="margin: 0"></p><p style="margin: 0">Please respond to them within 3 working days. Thank you!</p>',
          subject:
            'You have received a IT support request from {{Replace with response 3 name}}!',
          senderName: 'IT support request',
          destinationEmail: '{{Replace with reset device team email}}',
        },
      },
      {
        position: 4,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: {
          depth: 0,
          branchName: 'Damaged device',
          conditions: [
            {
              is: 'is',
              text: 'Damaged device',
              field: '{{Replace with response 1 request}}',
              condition: 'equals',
            },
          ],
        },
      },
      {
        position: 5,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        parameters: {
          body: '<p style="margin: 0">You have received a support request from {{Replace with response 3 name}}!</p><p style="margin: 0"></p><p style="margin: 0">Here is what their request is about:</p><p style="margin: 0">{{Replace with response 2 description}}</p><p style="margin: 0"></p><p style="margin: 0">Please respond to them within 3 working days. Thank you!</p>',
          subject:
            'You have received a IT support request from {{Replace with response 3 name}}!',
          senderName: 'IT support ',
          destinationEmail: '{{Replace with damage device email}}',
        },
      },
      {
        position: 6,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: {
          depth: 0,
          branchName: 'Lost device',
          conditions: [
            {
              is: 'is',
              text: 'Lost device',
              field: '{{Replace with response 1 request}}',
              condition: 'equals',
            },
          ],
        },
      },
      {
        position: 7,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
      },
      {
        position: 8,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: {
          depth: 0,
          branchName: 'New device',
          conditions: [
            {
              is: 'is',
              text: 'New device',
              field: '{{Replace with response 1 request}}',
              condition: 'equals',
            },
          ],
        },
      },
      {
        position: 9,
        templateId: ROUTE_SUPPORT_ENQUIRIES_ID,
      },
    ],
  },
  // Template: Get live updates through Telegram
  {
    id: GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID,
    name: 'Get live updates through Telegram',
    description:
      'Get updated on your operations quickly when you’re on the ground',
    // Steps: formsg --> telegram
    steps: [
      {
        position: 1,
        templateId: GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
        sampleUrl: 'https://form.gov.sg/66c2cfe9659625d2a4d9c037',
      },
      {
        position: 2,
        templateId: GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID,
        appKey: 'telegram-bot',
        eventKey: 'sendMessage',
        parameters: {},
      },
    ],
  },
  // Template: Send message to a Slack channel
  {
    id: SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID,
    name: 'Send message to a Slack channel',
    description: 'Schedule a recurring message to a Slack channel',
    // Steps: formsg --> slack
    steps: [
      {
        position: 1,
        templateId: SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID,
        appKey: 'scheduler',
        eventKey: 'everyWeek',
        parameters: { hour: '9', weekday: '3' },
      },
      {
        position: 2,
        templateId: SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID,
        appKey: 'slack',
        eventKey: 'sendMessageToChannel',
      },
    ],
  },
])
