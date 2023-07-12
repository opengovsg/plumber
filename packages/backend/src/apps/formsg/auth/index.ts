import { decryptFormResponse } from './decrypt-form-response'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

export default {
  fields: [
    {
      key: 'formId',
      label: 'Form URL',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description:
        'Enter your Form URL e.g. https://form.gov.sg/654ab1234abc1a012345f1e0b',
      clickToCopy: false,
      autoComplete: 'url' as const,
    },
    {
      key: 'privateKey',
      label: 'Form Secret Key',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description: 'Secret key for your Form',
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],
  verifyCredentials,
  isStillVerified,
  verifyWebhook: decryptFormResponse,
}
