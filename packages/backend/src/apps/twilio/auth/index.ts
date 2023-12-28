import type { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'accountSid',
      label: 'Account SID',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      // how to get twilio account sid
      description:
        'Your Twilio Account SID can be found under Account Info section at https://console.twilio.com/',
      clickToCopy: false,
    },
    {
      key: 'apiKeySid',
      label: 'API Key SID (Optional)',
      type: 'string' as const,
      required: false,
      readOnly: false,
      value: null,
      // how to get twilio api key sid
      description:
        'Your Twilio API Key SID can be found at https://www.twilio.com/console/project/api-keys',
      clickToCopy: false,
    },
    {
      key: 'authToken',
      label: 'Auth Token / API Key Secret',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description:
        "If an API Key SID was provided, please provide your API Key Secret. If not, please provide your account's auth token.",
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
}

export default auth
