import type { IUserAddedConnectionAuth } from '@plumber/types'

import generateAuthUrl from './generate-auth-url'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'oAuthRedirectUrl',
      label: 'OAuth Redirect URL',
      type: 'string' as const,
      required: true,
      readOnly: true,
      value: '{WEB_APP_URL}/app/slack/connections/add',
      description:
        'When asked to input an OAuth callback or redirect URL in Slack OAuth, enter the URL below.',
      clickToCopy: true,
      autoComplete: 'url' as const,
    },
    {
      key: 'consumerKey',
      label: 'Client ID',
      placeholder: 'Paste your Client ID here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description: null,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
    {
      key: 'consumerSecret',
      label: 'Client Secret',
      placeholder: 'Paste your Client Secret here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description: null,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  generateAuthUrl,
  verifyCredentials,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to Slack',
  },
}

export default auth
