import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

export default {
  fields: [
    {
      key: 'screenName',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
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
      placeholder: null,
      description: 'API key which should be retrieved from Vault Workspace.',
      clickToCopy: false,
    },
  ],
  verifyCredentials,
  isStillVerified,
}
