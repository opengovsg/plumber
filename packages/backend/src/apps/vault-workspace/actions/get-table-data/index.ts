import { IRawAction } from '@plumber/types'

import { throwVaultDeprecationError } from '../../common/throw-vault-deprecation-error'

// Note: column is still kept as dropdown so the db values are preserved
const action: IRawAction = {
  name: 'Get table data',
  key: 'getTableData',
  description: 'Gets a single row data from a Vault Workspace table',
  arguments: [
    {
      label: 'Lookup Column',
      key: 'lookupColumn',
      type: 'dropdown' as const,
      required: true,
      variables: true,
      description:
        'Specify a column we should look for cells which match the Lookup Value.',
    },

    {
      label: 'Lookup Value',
      key: 'lookupValue',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    throwVaultDeprecationError($)
  },
}

export default action
