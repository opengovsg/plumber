import type { ITemplate } from '@plumber/types'

// Note: template id is the same as demo video id for backwards compatibility
export const SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID = 'formsg-postman'

export const SEND_NOTIFICATIONS_DEMO_TEMPLATE: ITemplate = {
  id: SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID,
  name: 'Send notifications',
  description:
    'This demo shows you how to send out a customised email notification with each new form response. Common use cases include notifications, or acknowledgments and follow up instructions.',
  tag: 'demo',
  // Steps: formsg --> postman
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
    },
    {
      position: 2,
      appKey: 'postman',
      eventKey: 'sendTransactionalEmail',
    },
  ],
}
