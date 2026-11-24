import type { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'apiKey',
      label: 'API key from Pair',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      clickToCopy: false,
      autoComplete: 'off' as const,
    },
  ],

  verifyCredentials,
  isStillVerified,
  connectionModalLabel: {
    chooseConnectionLabel: 'Choose a Pair assistant',
    addConnectionLabel: 'Add a Pair assistant',
    // Empty hides the label above the dropdown.
    connectionFieldLabel: '',
    connectionFieldPlaceholder: 'Select a Pair assistant',
    termsNote:
      'Replies can include anything in your assistant’s knowledge base. You’re responsible for the data that goes into and out of your pipe.',
    connectedStatusPrefix: 'Using',
    changeConnectionLabel: 'Change assistant',
  },
}

export default auth
