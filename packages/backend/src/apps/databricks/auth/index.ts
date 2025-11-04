import { IUserAddedConnectionAuth } from '@plumber/types'

import isStillVerified from './is-still-verified'
import verifyCredentials from './verify-credentials'

const auth: IUserAddedConnectionAuth = {
  connectionType: 'user-added' as const,

  fields: [
    {
      key: 'screenName',
      label: 'Label',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'schema',
      label: 'Schema',
      type: 'string' as const,
      required: true,
      readOnly: false,
    },
    {
      key: 'token',
      label: 'Personal Access Token',
      docUrl:
        'https://docs.databricks.com/aws/en/dev-tools/auth/pat#create-personal-access-tokens-for-workspace-users',
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
    chooseConnectionLabel: 'Connect to Databricks',
  },
}

export default auth
