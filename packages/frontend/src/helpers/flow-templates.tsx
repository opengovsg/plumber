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

// Remember to sync with the backend!
const SEND_FOLLOW_UPS_NAME = 'Send follow ups'
const SEND_A_COPY_OF_FORM_RESPONSE_NAME = 'Send a copy of form response'
const SCHEDULE_REMINDERS_NAME = 'Schedule reminders'
const TRACK_FEEDBACK_NAME = 'Track feedback'
const ATTENDANCE_TAKING_NAME = 'Attendance taking'
const UPDATE_MAILING_LISTS_NAME = 'Update mailing lists'
const ROUTE_SUPPORT_ENQUIRIES_NAME = 'Route support enquiries'
const GET_LIVE_UPDATES_THROUGH_TELEGRAM_NAME =
  'Get live updates through Telegram'
const SEND_MESSAGE_TO_A_SLACK_CHANNEL_NAME = 'Send message to a Slack channel'

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

// This is to map from the template id to the icon to display
interface IconTemplateMap {
  [key: string]: ReactElement
}

export const FALLBACK_ICON = <BiQuestionMark fontSize="1.5rem" />

export const TEMPLATE_ICONS_MAP: IconTemplateMap = {
  [SEND_FOLLOW_UPS_NAME]: <BiEnvelope fontSize="1.5rem" />,
  [SEND_A_COPY_OF_FORM_RESPONSE_NAME]: <BiFile fontSize="1.5rem" />,
  [SCHEDULE_REMINDERS_NAME]: <BiCalendar fontSize="1.5rem" />,
  [TRACK_FEEDBACK_NAME]: <BiStar fontSize="1.5rem" />,
  [ATTENDANCE_TAKING_NAME]: <BiCheckDouble fontSize="1.5rem" />,
  [UPDATE_MAILING_LISTS_NAME]: <BiListUl fontSize="1.5rem" />,
  [ROUTE_SUPPORT_ENQUIRIES_NAME]: <BiInfoCircle fontSize="1.5rem" />,
  [GET_LIVE_UPDATES_THROUGH_TELEGRAM_NAME]: <BiBell fontSize="1.5rem" />,
  [SEND_MESSAGE_TO_A_SLACK_CHANNEL_NAME]: <BiMessageAlt fontSize="1.5rem" />,
}
