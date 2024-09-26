import { ComponentType } from 'react'
import * as Icons from 'react-icons/bi'

import type { DemoVideoDetails } from '@/graphql/__generated__/graphql'

/** DEMO TEMPLATES */
export const SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID = 'formsg-postman'

// TODO: move to backend in separate PR
// This is to map from the backend config to the video content, so we can modify it here
// instead of needing to modify the db data unnecessarily
export const DEMO_VIDEOS_MAP: Record<string, DemoVideoDetails> = {
  [SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID]: {
    url: 'https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true',
    title: 'Send notifications',
  },
}

interface TemplateIconProps {
  iconName?: string | null
  fontSize?: string
}

export const TemplateIcon = ({
  iconName = 'BiQuestionMark', // fallback icon
  fontSize = '1.5rem',
}: TemplateIconProps) => {
  if (iconName === null) {
    return <></>
  }

  const IconComponent = (
    Icons as Record<string, ComponentType<{ fontSize?: string }>>
  )[iconName]
  return <IconComponent fontSize={fontSize} />
}

export const HELP_MESSAGE_MAP: Record<string, string> = {
  postman: 'Customise how your email looks like in this step.',
  slack: 'Connect a Slack channel in this step.',
  'telegram-bot': 'Connect your Telegram bot in this step.',
}
