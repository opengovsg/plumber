import { decryptFormResponse } from './decrypt-form-response';
import isStillVerified from './is-still-verified';
import verifyCredentials from './verify-credentials';

export default {
  fields: [
    {
      key: 'formId',
      label: 'Form ID',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      placeholder: null,
      description: 'Unique ID of your Form',
      clickToCopy: false
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
      clickToCopy: false
    }
  ],
  verifyCredentials,
  isStillVerified,
  verifyWebhook: decryptFormResponse
};
