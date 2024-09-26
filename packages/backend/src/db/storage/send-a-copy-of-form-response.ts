import type { Template } from '@/graphql/__generated__/types.generated'

const SEND_A_COPY_OF_FORM_RESPONSE_ID = 'd06d1024-2f1d-46ca-b9b3-2d3d073eddfe'

export const SEND_A_COPY_OF_FORM_RESPONSE_TEMPLATE: Template = {
  id: SEND_A_COPY_OF_FORM_RESPONSE_ID,
  name: 'Send a copy of form response',
  description: 'Send respondents a copy of their form response',
  iconName: 'BiFile',
  // Steps: formsg --> postman
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2bb59c28ac9d16c1b62c9',
    },
    {
      position: 2,
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
}
