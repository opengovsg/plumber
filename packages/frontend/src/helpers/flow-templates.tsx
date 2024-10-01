import { IFlowTemplateConfig } from '@plumber/types'

import { ComponentType } from 'react'
import * as Icons from 'react-icons/bi'

import appConfig from '@/config/app'
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

// key: app_event key pair, value: help message
// <<form_id>> and <<tile_id>> have to be replaced
const FORM_ID_PLACEHOLDER = '<<form_id>>'
const TILE_ID_PLACEHOLDER = '<<tile_id>>'
const tileLink = `${appConfig.webAppUrl}/tiles/${TILE_ID_PLACEHOLDER}`
export const HELP_MESSAGE_MAP: Record<string, string> = {
  formsg_newSubmission: `Connect your form to this step. Here is an [example](https://form.gov.sg/${FORM_ID_PLACEHOLDER}) for this template.`,
  tiles_createTileRow: `We’ve already created a [Tile](${tileLink}) for you that you can customise in this step.`,
  tiles_findSingleRow: `This step finds a row in your [Tile](${tileLink}) based on conditions you set.`,
  tiles_updateSingleRow: `This step updates the row that was found in your [Tile](${tileLink}). You need a Find row step before this.`,
  postman_sendTransactionalEmail:
    'Customise how your email looks like in this step.',
  slack_sendMessageToChannel: 'Connect a Slack channel in this step.',
  'telegram-bot_sendMessage': 'Connect your Telegram bot in this step.',
}

export function replacePlaceholdersForHelpMessage(
  appEventKey?: string,
  templateConfig?: IFlowTemplateConfig,
): string {
  if (!appEventKey || !templateConfig) {
    return ''
  }
  const helpMessage = HELP_MESSAGE_MAP[appEventKey] ?? ''
  const { formId, tileId } = templateConfig
  if (formId) {
    helpMessage.replace(FORM_ID_PLACEHOLDER, formId)
  }

  if (tileId) {
    return helpMessage.replace(TILE_ID_PLACEHOLDER, tileId)
  }
  return helpMessage
}
