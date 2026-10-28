import { IUserAddedConnectionAuth } from '@plumber/types'

import getConnectionEnvironment from './get-connection-environment'
import getEditableConnectionLabel from './get-editable-connection-label'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,
  supportsConnectionEdit: true,
  getEditableConnectionLabel,
  getConnectionEnvironment,

  fields: [
    {
      key: 'screenName',
      label: 'Label',
      placeholder: 'My LetterSG account',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'apiKey',
      label: 'API key',
      placeholder: 'Paste your API key here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Connect to LetterSG',
  },
}

export default auth
