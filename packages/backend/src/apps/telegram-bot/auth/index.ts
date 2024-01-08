import type { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'token',
      label: 'Bot token',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description: 'Bot token which should be retrieved from @botfather.',
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
}

export default auth
