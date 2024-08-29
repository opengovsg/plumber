import { ComponentType } from 'react'
import * as Icons from 'react-icons/bi'

import type { DemoVideoDetails } from '@/graphql/__generated__/graphql'

/** DEMO TEMPLATES */
export const FORMSG_POSTMAN_TEMPLATE_ID = 'formsg-postman'

// This is to map from the backend config to the video content, so we can modify it here
// instead of needing to modify the db data unnecessarily
export const DEMO_VIDEOS_MAP: Record<string, DemoVideoDetails> = {
  [FORMSG_POSTMAN_TEMPLATE_ID]: {
    url: 'https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true',
    title: 'Send notifications',
  },
}

interface TemplateIconProps {
  iconName: string
  fontSize?: string
}

export const TemplateIcon = ({
  iconName,
  fontSize = '1.5rem',
}: TemplateIconProps) => {
  const IconComponent = (
    Icons as Record<string, ComponentType<{ fontSize?: string }>>
  )[iconName]

  // sanity check: use a fallback icon
  if (!IconComponent) {
    return <Icons.BiQuestionMark fontSize={fontSize} />
  }

  return <IconComponent fontSize={fontSize} />
}
