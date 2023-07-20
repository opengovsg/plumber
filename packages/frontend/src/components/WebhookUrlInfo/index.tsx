import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { List, ListItem } from '@mui/material'
import type { AlertProps } from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
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
  const descriptionStep1 =
    triggerType === 'formsg'
      ? formatMessage('webhookUrlInfo.formsgDescription')
      : formatMessage('webhookUrlInfo.rawWebhookDescription')
  return (
    <Alert icon={false} color="info" {...alertProps}>
      {/* <Typography variant="body2" textAlign="center">
        <FormattedMessage id="webhookUrlInfo.title" />
      </Typography> */}

      {/* <Typography variant="body1" textAlign="center">
        <FormattedMessage id="webhookUrlInfo.description" />
      </Typography> */}
      <List sx={{ listStyle: 'decimal', pl: 4 }}>
        <ListItem sx={{ display: 'list-item' }}>
          {descriptionStep1}
          <TextField
            readOnly
            clickToCopy={true}
            name="webhookUrl"
            fullWidth
            defaultValue={webhookUrl}
            helperText={<>{formatMessage('webhookUrlInfo.helperText')}</>}
          />
        </ListItem>
        <ListItem sx={{ display: 'list-item' }}>
          {formatMessage('webhookUrlInfo.descriptionStep2')}
        </ListItem>
        <ListItem sx={{ display: 'list-item' }}>
          {formatMessage('webhookUrlInfo.descriptionStep3')}
        </ListItem>
      </List>
    </Alert>
  )
}

export default WebhookUrlInfo
