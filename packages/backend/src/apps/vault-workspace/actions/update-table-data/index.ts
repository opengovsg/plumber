import { IRawAction } from '@plumber/types'

import { throwVaultDeprecationError } from '../../common/throw-vault-deprecation-error'

// Note: columns are still kept as dropdown so the db values are preserved
const action: IRawAction = {
  name: 'Update table data',
  key: 'updateTableData',
  description: 'Updates a single row in a Vault Workspace table',
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
    {
      label: 'Update Column',
      key: 'updateColumn',
      type: 'dropdown' as const,
      required: true,
      variables: true,
      description:
        'Specify a column we should update for cells with the Update Value.',
    },
    {
      label: 'Update Value',
      key: 'updateValue',
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
