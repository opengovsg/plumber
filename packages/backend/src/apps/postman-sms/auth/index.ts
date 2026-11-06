import { IUserAddedConnectionAuth } from '@plumber/types'

import getEditableConnectionLabel from './get-editable-connection-label'
import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,
  supportsConnectionEdit: true,
  getEditableConnectionLabel,

  fields: [
    {
      // We will prefix the label with "[TEST]" if the user is adding a test env
      // campaign.
      key: 'screenName',
      label: 'Label',
      placeholder: 'My SMS account',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'campaignId',
      label: 'Campaign ID',
      placeholder: 'Paste your campaign ID here',
      type: 'string' as const,
      required: true,
      readOnly: false,
      clickToCopy: false,
      autoComplete: 'url' as const,
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
    chooseConnectionLabel: 'Choose campaign to connect',
    addConnectionLabel: 'Add new campaign',
  },
}

export default auth
