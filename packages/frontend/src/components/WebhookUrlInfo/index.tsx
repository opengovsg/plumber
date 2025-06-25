import { ITriggerInstructions } from '@plumber/types'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import { Alert, AlertProps, Box } from '@chakra-ui/react'

import TextField from '../TextField'

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
    <Alert
      status="info"
      {...alertProps}
      display="block"
      colorScheme="default"
      bg="gray.50"
      borderRadius="sm"
    >
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
