import { IUserAddedConnectionAuth } from '@plumber/types'

import { decryptResponse } from './decrypt-response'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'screenName',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'apiKey',
      label: 'API key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  verifyWebhook: decryptResponse,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to Ownself Gather',
  },
}

export default auth
