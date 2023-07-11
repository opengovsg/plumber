import generateAuthUrl from './generate-auth-url'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

export default {
  fields: [
    {
      key: 'oAuthRedirectUrl',
      label: 'OAuth Redirect URL',
      type: 'string' as const,
      required: true,
      readOnly: true,
      value: '{WEB_APP_URL}/app/slack/connections/add',
      placeholder: null,
      description:
        'When asked to input an OAuth callback or redirect URL in Slack OAuth, enter the URL above.',
      clickToCopy: true,
      autoComplete: 'url' as const,
    },
    {
      key: 'consumerKey',
      label: 'API Key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description: null,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
    {
      key: 'consumerSecret',
      label: 'API Secret',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description: null,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  generateAuthUrl,
  verifyCredentials,
  isStillVerified,
}
