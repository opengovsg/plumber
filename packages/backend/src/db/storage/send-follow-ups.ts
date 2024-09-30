import type { ITemplate } from '@plumber/types'

import {
  CREATE_TEMPLATE_PLACEHOLDER,
  CREATE_TEMPLATE_STEP_VARIABLE,
  FORMSG_SAMPLE_URL_DESCRIPTION,
  USER_EMAIL_PLACEHOLDER,
} from './constants'

const SEND_FOLLOW_UPS_ID = 'aae185f7-2592-4683-a812-2d412232e403'

export const SEND_FOLLOW_UPS_TEMPLATE: ITemplate = {
  id: SEND_FOLLOW_UPS_ID,
  name: 'Send follow ups',
  description: 'Send follow up emails to respondents after they submit a form',
  iconName: 'BiEnvelope',
  tag: 'empty',
  // Steps: formsg --> postman
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2bb59c28ac9d16c1b62c9',
      sampleUrlDescription: FORMSG_SAMPLE_URL_DESCRIPTION,
    },
    {
      position: 2,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
      parameters: {
        body: `<p style="margin: 0">Hi ${CREATE_TEMPLATE_STEP_VARIABLE(
          'Replace this with data from step 1',
        )},</p><p style="margin: 0"></p><p style="margin: 0">We have received your registration for this event! More details will be sent to you nearer to the event date.</p><p style="margin: 0"></p><p style="margin: 0">Cheers,</p><p style="margin: 0">Event organising committee</p>`,
        subject: 'Thank you for registering!',
        senderName: 'Event committee',
        destinationEmail: CREATE_TEMPLATE_PLACEHOLDER(USER_EMAIL_PLACEHOLDER),
      },
    },
  ],
}
