import * as React from 'react'
import { List, ListItem } from '@mui/material'
import type { AlertProps } from '@mui/material/Alert'
import useFormatMessage from 'hooks/useFormatMessage'

import TextField from '../TextField'

import { Alert } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
  triggerType: string | undefined // either formSG or raw webhook
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, triggerType, ...alertProps } = props
  const formatMessage = useFormatMessage()
  const isFormsg = triggerType === 'formsg'
  const descriptionStep1 = isFormsg
    ? formatMessage('webhookUrlInfo.formsgDescriptionStep1')
    : formatMessage('webhookUrlInfo.rawWebhookDescriptionStep1')
  const descriptionStep2 = isFormsg
    ? formatMessage('webhookUrlInfo.formsgDescriptionStep2')
    : formatMessage('webhookUrlInfo.rawWebhookDescriptionStep2')
  return (
    <Alert icon={false} color="info" {...alertProps}>
      <List sx={{ listStyle: 'decimal', pl: 4 }}>
        <ListItem sx={{ display: 'list-item' }}>
          {descriptionStep1}
          <TextField
            readOnly
            clickToCopy={true}
            name="webhookUrl"
            fullWidth
            defaultValue={webhookUrl}
          />
        </ListItem>
        <ListItem sx={{ display: 'list-item' }}>{descriptionStep2}</ListItem>
        <ListItem sx={{ display: 'list-item' }}>
          {formatMessage('webhookUrlInfo.descriptionStep3')}
        </ListItem>
      </List>
    </Alert>
  )
}

export default WebhookUrlInfo
