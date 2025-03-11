import type { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      clickToCopy: false,
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      clickToCopy: false,
    },
  ],

  verifyCredentials,
  isStillVerified,
  connectionRegistrationType: 'global' as const,
  verifyConnectionRegistration: async ($) => {
    try {
      await verifyCredentials($)
      return {
        registrationVerified: true,
        message: 'Connection verified',
      }
    } catch (err) {
      return {
        registrationVerified: false,
        message:
          'Invalid connection. Check your client ID and client secret again.',
      }
    }
  },
}

export default auth
