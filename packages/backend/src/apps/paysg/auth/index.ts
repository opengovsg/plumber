import { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'screenName',
      label: 'Label',
      placeholder: 'My PaySG account',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'paymentServiceId',
      label: 'Payment Service ID',
      placeholder: 'Paste your payment service ID here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
    },
    {
      key: 'apiKey',
      label: 'API key',
      placeholder: 'Paste your API key here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to PaySG',
  },
}

export default auth
