import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert, MessageWrapper } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerText: string
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, webhookTriggerText, ...alertProps } = props
  const descriptionMessagesArray = webhookTriggerText.split('|') // this should have 2 different message to show

  return (
    <Alert icon={false} color="info" {...alertProps}>
      <MessageWrapper>
        <ReactMarkdown>{descriptionMessagesArray[0]}</ReactMarkdown>
      </MessageWrapper>
      <TextField
        readOnly
        clickToCopy={true}
        name="webhookUrl"
        fullWidth
        defaultValue={webhookUrl}
      />
      <MessageWrapper>
        <ReactMarkdown>{descriptionMessagesArray[1]}</ReactMarkdown>
      </MessageWrapper>
    </Alert>
  )
}

export default WebhookUrlInfo
