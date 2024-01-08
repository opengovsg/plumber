import type { IUserAddedConnectionAuth } from '@plumber/types'

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
      value: null,
      description: 'Label for your Vault Workspace API Key.',
      clickToCopy: false,
    },
    {
      key: 'apiKey',
      label: 'Table API Key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description: 'API key which should be retrieved from Vault Workspace.',
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],
  verifyCredentials,
  isStillVerified,
}

export default auth
