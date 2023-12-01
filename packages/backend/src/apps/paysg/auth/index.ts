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
    },
    {
      key: 'paymentServiceId',
      label: 'Payment Service ID',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
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
  isStillVerified,
}
