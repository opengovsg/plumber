import type { ITemplate } from '@plumber/types'

import {
  CREATE_TEMPLATE_STEP_VARIABLE,
  FORMSG_SAMPLE_URL_DESCRIPTION,
  USER_EMAIL_PLACEHOLDER,
} from './constants'

const ROUTE_SUPPORT_ENQUIRIES_ID = '2a84e2f6-4806-46a2-890a-0dba1411b12f'

export const ROUTE_SUPPORT_ENQUIRIES_TEMPLATE: ITemplate = {
  id: ROUTE_SUPPORT_ENQUIRIES_ID,
  name: 'Route support enquiries',
  description: 'Route enquiries to the correct departments to process',
  iconName: 'BiDirections',
  // Steps: formsg --> if-then to 4 branches
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2d127c61aa529969562c6',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'Resetting device',
        conditions: [
          {
            is: 'is',
            text: 'Resetting device',
            field: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with response 1 request',
            ),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 3,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      parameters: {
        body: `<p style="margin: 0">You have received a support request from ${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}! </p><p style="margin: 0"></p><p style="margin: 0">Here is what their request is about: </p><p style="margin: 0">${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}</p><p style="margin: 0"></p><p style="margin: 0">Please respond to them within 3 working days. Thank you!</p>`,
        subject: `You have received a IT support request from ${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}!`,
        senderName: 'IT support request',
        destinationEmail: USER_EMAIL_PLACEHOLDER,
      },
    },
    {
      position: 4,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'Damaged device',
        conditions: [
          {
            is: 'is',
            text: 'Damaged device',
            field: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with response 1 request',
            ),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 5,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      parameters: {
        body: `<p style="margin: 0">You have received a support request from ${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}!</p><p style="margin: 0"></p><p style="margin: 0">Here is what their request is about:</p><p style="margin: 0">${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}</p><p style="margin: 0"></p><p style="margin: 0">Please respond to them within 3 working days. Thank you!</p>`,
        subject: `You have received a IT support request from ${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )}!`,
        senderName: 'IT support ',
        destinationEmail: USER_EMAIL_PLACEHOLDER,
      },
    },
    {
      position: 6,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'Lost device',
        conditions: [
          {
            is: 'is',
            text: 'Lost device',
            field: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with response 1 request',
            ),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 7,
    },
    {
      position: 8,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: {
        depth: 0,
        branchName: 'New device',
        conditions: [
          {
            is: 'is',
            text: 'New device',
            field: CREATE_TEMPLATE_STEP_VARIABLE(
              'Replace with response 1 request',
            ),
            condition: 'equals',
          },
        ],
      },
    },
    {
      position: 9,
    },
  ],
}
