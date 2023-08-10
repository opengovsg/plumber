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

  return (
    <Alert icon={false} color="info" {...alertProps}>
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerInstructions.beforeUrlMsg}</ReactMarkdown>
      </MessageWrapper>
      <TextField
        readOnly
        clickToCopy={true}
        name="webhookUrl"
        fullWidth
        defaultValue={webhookUrl}
      />
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerInstructions.afterUrlMsg}</ReactMarkdown>
      </MessageWrapper>
    </Alert>
  )
}

export default WebhookUrlInfo
