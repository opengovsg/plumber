import { IRawAction } from '@plumber/types'

import { VAULT_ID } from '../../common/constants'
import filterTableRows from '../../common/filter-table-rows'
import updateTableRow from '../../common/update-table-row'

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
      source: {
        type: 'query',
        name: 'getDynamicData',
        arguments: [
          {
            name: 'key',
            value: 'listColumns',
          },
        ],
      },
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
      source: {
        type: 'query',
        name: 'getDynamicData',
        arguments: [
          {
            name: 'key',
            value: 'listUpdatableColumns',
          },
        ],
      },
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
    const lookupColumn = $.step.parameters.lookupColumn as string
    const lookupValue = $.step.parameters.lookupValue as string
    const updateColumn = $.step.parameters.updateColumn as string
    const updateValue = $.step.parameters.updateValue as string

    if (updateColumn === VAULT_ID) {
      throw new Error('Cannot update the row id.')
    }

    const row = await filterTableRows($, lookupColumn, lookupValue)
    if (row._metadata?.rowsFound === 0) {
      $.setActionItem({
        raw: {
          _metadata: {
            success: false,
            rowsUpdated: 0,
          },
        },
      })
      return
    }
    // update row
    const payload: { [key: string]: string } = { [updateColumn]: updateValue }
    const response = await updateTableRow($, row[VAULT_ID], payload)
    $.setActionItem({
      raw: response,
    })
  },
}

export default action
