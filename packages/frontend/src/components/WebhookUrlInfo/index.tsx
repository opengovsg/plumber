import { ITriggerInstructions } from '@plumber/types'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerInstructions: ITriggerInstructions
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, webhookTriggerInstructions, ...alertProps } = props

  const { beforeUrlMsg, afterUrlMsg, hideWebhookUrl } =
    webhookTriggerInstructions

  if (!beforeUrlMsg && hideWebhookUrl && !afterUrlMsg) {
    return <></>
  }

  return (
    <Alert icon={false} color="info" {...alertProps}>
      {beforeUrlMsg && <ReactMarkdown>{beforeUrlMsg}</ReactMarkdown>}
      {!hideWebhookUrl && (
        <TextField
          sx={{
            my: '1rem',
          }}
          readOnly
          clickToCopy={true}
          name="webhookUrl"
          fullWidth
          defaultValue={webhookUrl}
        />
      )}
      {afterUrlMsg && <ReactMarkdown>{afterUrlMsg}</ReactMarkdown>}
    </Alert>
  )
}

export default WebhookUrlInfo
