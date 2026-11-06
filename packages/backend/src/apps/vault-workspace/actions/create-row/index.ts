import { IRawAction } from '@plumber/types'

import { throwVaultDeprecationError } from '../../common/throw-vault-deprecation-error'

const action: IRawAction = {
  name: 'Create row',
  key: 'createRow',
  description: 'Creates a new row in Vault Workspace table.',
  arguments: [
    {
      label: 'Columns',
      placeholder: 'Name,Email,Phone',
      key: 'columns',
      type: 'string' as const,
      required: true,
      variables: false,
      description:
        'Put a comma between each column. Enclose columns with double-quotes (") if it contains commas. Columns can contain double quotes, but use single quotes if problems arise.',
    },
    {
      label: 'Values',
      placeholder: 'Alex,alex@example.com',
      key: 'values',
      type: 'string' as const,
      required: true,
      variables: true,
      description: 'Put a comma between each value.',
    },
  ],

  async run(_) {
    throwVaultDeprecationError()
  },
}

export default action
