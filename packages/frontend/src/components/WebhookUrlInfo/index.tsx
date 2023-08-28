import { ITriggerInstructions } from '@plumber/types'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert, MessageWrapper } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerInstructions: ITriggerInstructions
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, webhookTriggerInstructions, ...alertProps } = props

  const { beforeUrlMsg, afterUrlMsg, hideWebhookUrl } =
    webhookTriggerInstructions

  return (
    <Alert icon={false} color="info" {...alertProps}>
      {beforeUrlMsg && (
        <MessageWrapper>
          <ReactMarkdown>{beforeUrlMsg}</ReactMarkdown>
        </MessageWrapper>
      )}
      {!hideWebhookUrl && (
        <TextField
          readOnly
          clickToCopy={true}
          name="webhookUrl"
          fullWidth
          defaultValue={webhookUrl}
        />
      )}
      {afterUrlMsg && (
        <MessageWrapper>
          <ReactMarkdown>{afterUrlMsg}</ReactMarkdown>
        </MessageWrapper>
      )}
    </Alert>
  )
}

export default WebhookUrlInfo
