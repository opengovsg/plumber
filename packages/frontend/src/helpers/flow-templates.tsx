import { ReactElement } from 'react'
import {
  BiBell,
  BiCalendar,
  BiCheckDouble,
  BiEnvelope,
  BiFile,
  BiInfoCircle,
  BiListUl,
  BiMessageAlt,
  BiQuestionMark,
  BiStar,
} from 'react-icons/bi'

import type {
  CreateTemplatedFlowInput,
  DemoVideoDetails,
} from '@/graphql/__generated__/graphql'

export const FORMSG_POSTMAN_TEMPLATE = 'formsg-postman'

// This is to map from the backend config to the video content, so we can modify it here
// instead of needing to modify the db data unnecessarily
export const DEMO_VIDEOS_MAP: Record<string, DemoVideoDetails> = {
  [FORMSG_POSTMAN_TEMPLATE]: {
    url: 'https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true',
    title: 'Send notifications',
  },
}

export const FLOW_TEMPLATES_MAP: Record<string, CreateTemplatedFlowInput> = {
  [FORMSG_POSTMAN_TEMPLATE]: {
    flowName: 'Send notifications',
    trigger: {
      appKey: 'formsg',
      eventKey: 'newSubmission',
    },
    actions: [
      {
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
      },
    ],
    demoVideoId: FORMSG_POSTMAN_TEMPLATE,
  },
}

// This is to map from the template name to the icon to display
interface IconTemplateMap {
  [key: string]: ReactElement
}

export const FALLBACK_ICON = <BiQuestionMark fontSize="1.5rem" />

export const TEMPLATE_ICONS_MAP: IconTemplateMap = {
  'Send follow ups': <BiEnvelope fontSize="1.5rem" />,
  'Send a copy of form response': <BiFile fontSize="1.5rem" />,
  'Schedule reminders': <BiCalendar fontSize="1.5rem" />,
  'Track feedback': <BiStar fontSize="1.5rem" />,
  'Attendance taking': <BiCheckDouble fontSize="1.5rem" />,
  'Update mailing lists': <BiListUl fontSize="1.5rem" />,
  'Route support enquiries': <BiInfoCircle fontSize="1.5rem" />,
  'Get live updates through Telegram': <BiBell fontSize="1.5rem" />,
  'Send message to a Slack channel': <BiMessageAlt fontSize="1.5rem" />,
}
