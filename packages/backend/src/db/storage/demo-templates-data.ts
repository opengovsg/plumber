import type { Template } from '@/graphql/__generated__/types.generated'

import { deepFreeze } from './helpers/freeze-template'

// Note: template id is the same as demo video id for backwards compatibility
export const FORMSG_POSTMAN_TEMPLATE_ID = 'formsg-postman'

// Demo templates follows the format for templates, just lesser info
export const DEMO_TEMPLATES: Template[] = deepFreeze<Template[]>([
  // Demo template: Send notifications
  {
    id: FORMSG_POSTMAN_TEMPLATE_ID,
    name: 'Send notifications',
    description:
      'This demo shows you how to send out a customised email notification with each new form response. Common use cases include notifications, or acknowledgments and follow up instructions.',
    // Steps: formsg --> postman
    steps: [
      {
        position: 1,
        templateId: FORMSG_POSTMAN_TEMPLATE_ID,
        appKey: 'formsg',
        eventKey: 'newSubmission',
      },
      {
        position: 2,
        templateId: FORMSG_POSTMAN_TEMPLATE_ID,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
      },
    ],
  },
])
