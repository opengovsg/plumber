import type { IUserAddedConnectionAuth } from '@plumber/types'

import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'label',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
      value: null,
      clickToCopy: false,
    },
    {
      key: 'headers',
      label: 'Headers',
      type: 'multiline' as const,
      required: false,
      readOnly: false,
      value: null,
      description:
        'Enter your headers in this format: KEY=VALUE (one per line)',
      clickToCopy: false,
    },
  ],

  verifyCredentials,
  isStillVerified: () => Promise.resolve(true),
}

export default auth
