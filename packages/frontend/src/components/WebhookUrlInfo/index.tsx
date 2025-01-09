import { ITriggerInstructions } from '@plumber/types'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import { Box } from '@chakra-ui/react'
import type { AlertProps } from '@mui/material/Alert'

import TextField from '../TextField'

import { Alert } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  webhookTriggerInstructions: ITriggerInstructions
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookTriggerInstructions, ...alertProps } = props

  const { beforeUrlMsg, afterUrlMsg, hideWebhookUrl } =
    webhookTriggerInstructions

  if (!beforeUrlMsg && hideWebhookUrl && !afterUrlMsg) {
    return <></>
  }

  return (
    <Alert icon={false} color="info" {...alertProps}>
      {beforeUrlMsg && <ReactMarkdown>{beforeUrlMsg}</ReactMarkdown>}
      {!hideWebhookUrl && (
        <Box my={4}>
          <TextField readOnly clickToCopy={true} name="webhookUrl" />
        </Box>
      )}
      {afterUrlMsg && <ReactMarkdown>{afterUrlMsg}</ReactMarkdown>}
    </Alert>
  )
}

export default WebhookUrlInfo
