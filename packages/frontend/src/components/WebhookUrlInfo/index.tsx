import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import type { AlertProps } from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import useFormatMessage from 'hooks/useFormatMessage'

import TextField from '../TextField'

import { Alert } from './style'

type WebhookUrlInfoProps = {
  webhookUrl: string
} & AlertProps

function WebhookUrlInfo(props: WebhookUrlInfoProps): React.ReactElement {
  const { webhookUrl, ...alertProps } = props
  const formatMessage = useFormatMessage()

  return (
    <Alert icon={false} color="info" {...alertProps}>
      <Typography variant="body2" textAlign="center">
        <FormattedMessage id="webhookUrlInfo.title" />
      </Typography>

      <Typography variant="body1" textAlign="center">
        <FormattedMessage id="webhookUrlInfo.description" />
      </Typography>

      <TextField
        readOnly
        clickToCopy={true}
        name="webhookUrl"
        fullWidth
        defaultValue={webhookUrl}
        description={formatMessage('webhookUrlInfo.helperText')}
      />
    </Alert>
  )
}

export default WebhookUrlInfo
