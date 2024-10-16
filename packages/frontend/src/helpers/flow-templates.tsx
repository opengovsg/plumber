import { IFlowTemplateConfig } from '@plumber/types'

import { ComponentType } from 'react'
import * as Icons from 'react-icons/bi'

import * as URLS from '@/config/urls'

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

/**
 * chose app_event key since it is unique among all triggers and actions
 * key: app_event key pair, value: help message
 * <<form_id>> and <<tile_id>> have to be replaced
 */
const FORM_ID_PLACEHOLDER = '<<form_id>>'
const TILE_ID_PLACEHOLDER = '<<tile_id>>'
const tileLink = URLS.TILE(TILE_ID_PLACEHOLDER)
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
  let helpMessage = HELP_MESSAGE_MAP[appEventKey] ?? ''
  const { formId, tileId } = templateConfig
  if (formId) {
    helpMessage = helpMessage.replace(FORM_ID_PLACEHOLDER, formId)
  }

  if (tileId) {
    helpMessage = helpMessage.replace(TILE_ID_PLACEHOLDER, tileId)
  }
  return helpMessage
}
