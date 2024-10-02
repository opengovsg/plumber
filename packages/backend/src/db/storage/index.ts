import type { ITemplate } from '@plumber/types'

import { ATTENDANCE_TAKING_TEMPLATE } from './attendance-taking'
import { SEND_NOTIFICATIONS_DEMO_TEMPLATE } from './demo-send-notifications'
import { GET_LIVE_UPDATES_THROUGH_TELEGRAM_TEMPLATE } from './get-live-updates-through-telegram'
import { ROUTE_SUPPORT_ENQUIRIES_TEMPLATE } from './route-support-enquiries'
import { SCHEDULE_REMINDERS_TEMPLATE } from './schedule-reminders'
import { SEND_A_COPY_OF_FORM_RESPONSE_TEMPLATE } from './send-a-copy-of-form-response'
import { SEND_FOLLOW_UPS_TEMPLATE } from './send-follow-ups'
import { SEND_MESSAGE_TO_A_SLACK_CHANNEL_TEMPLATE } from './send-message-to-a-slack-channel'
import { TRACK_FEEDBACK_TEMPLATE } from './track-feedback'
import { UPDATE_MAILING_LISTS_TEMPLATE } from './update-mailing-lists'

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

export const TEMPLATES: ITemplate[] = deepFreeze<ITemplate[]>([
  SEND_FOLLOW_UPS_TEMPLATE,
  SEND_A_COPY_OF_FORM_RESPONSE_TEMPLATE,
  SCHEDULE_REMINDERS_TEMPLATE,
  TRACK_FEEDBACK_TEMPLATE,
  ATTENDANCE_TAKING_TEMPLATE,
  UPDATE_MAILING_LISTS_TEMPLATE,
  ROUTE_SUPPORT_ENQUIRIES_TEMPLATE,
  GET_LIVE_UPDATES_THROUGH_TELEGRAM_TEMPLATE,
  SEND_MESSAGE_TO_A_SLACK_CHANNEL_TEMPLATE,
  SEND_NOTIFICATIONS_DEMO_TEMPLATE, // one and only demo template
])
