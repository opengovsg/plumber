import { IGlobalVariable } from '@plumber/types'

import verifyCredentials from './verify-credentials'

const isStillVerified = async ($: IGlobalVariable) => {
  await verifyCredentials($)
  return true
}

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
      description: 'Label for your Postman API Key.',
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
