import type { IUserAddedConnectionAuth } from '@plumber/types'

import {
  registerWebhookUrl,
  verifyWebhookUrl,
} from '../common/webhook-settings'

import { decryptFormResponse } from './decrypt-form-response'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'formId',
      label: 'Form URL',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      description: 'Click share on your form and copy the link from there',
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
      description:
        'This is the key you downloaded/saved when you created the form',
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
  verifyWebhook: decryptFormResponse,

  connectionRegistrationType: 'per-step' as const,
  registerConnection: registerWebhookUrl,
  verifyConnectionRegistration: verifyWebhookUrl,
}

export default auth
