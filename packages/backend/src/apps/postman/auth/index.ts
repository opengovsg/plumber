import { IGlobalVariable } from '@plumber/types'

const verifyCredentials = async ($: IGlobalVariable) => {
  /**
   * A mutation-free endpoint to verify an API key does not exist.
   * Verification therefore always succeeds.
   */
  await $.auth.set({
    screenName: $.auth.data.screenName,
  })
}

const isStillVerified = async ($: IGlobalVariable) => {
  await verifyCredentials($)
  return true
}

export default {
  fields: [
    {
      key: 'screenName',
      label: 'Screen Name',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description:
        'Screen name of your connection to be used on Automatisch UI.',
      clickToCopy: false,
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description: 'Postman API key.',
      clickToCopy: false,
    },
  ],
  verifyCredentials,
  isStillVerified,
}
