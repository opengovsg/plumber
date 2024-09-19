import type { Template } from '@/graphql/__generated__/types.generated'

const ROUTE_SUPPORT_ENQUIRIES_ID = '2a84e2f6-4806-46a2-890a-0dba1411b12f'

export const ROUTE_SUPPORT_ENQUIRIES_TEMPLATE: Template = {
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
}
