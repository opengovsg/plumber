import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert, MessageWrapper } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerTexts: string[]
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, webhookTriggerTexts, ...alertProps } = props

  return (
    <Alert icon={false} color="info" {...alertProps}>
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerTexts[0]}</ReactMarkdown>
      </MessageWrapper>
      <TextField
        readOnly
        clickToCopy={true}
        name="webhookUrl"
        fullWidth
        defaultValue={webhookUrl}
      />
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerTexts[1]}</ReactMarkdown>
      </MessageWrapper>
    </Alert>
  )
}

export default WebhookUrlInfo
