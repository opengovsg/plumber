import { ITriggerAlert } from '@plumber/types'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert, MessageWrapper } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerAlert: ITriggerAlert
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, webhookTriggerAlert, ...alertProps } = props

  return (
    <Alert icon={false} color="info" {...alertProps}>
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerAlert.beforeUrlMsg}</ReactMarkdown>
      </MessageWrapper>
      <TextField
        readOnly
        clickToCopy={true}
        name="webhookUrl"
        fullWidth
        defaultValue={webhookUrl}
      />
      <MessageWrapper>
        <ReactMarkdown>{webhookTriggerAlert.afterUrlMsg}</ReactMarkdown>
      </MessageWrapper>
    </Alert>
  )
}

export default WebhookUrlInfo
