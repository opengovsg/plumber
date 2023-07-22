import { IJSONObject } from '@plumber/types'

import defineAction from '@/helpers/define-action'

import { VAULT_ID } from '../../common/constants'
import filterTableRows from '../../common/filter-table-rows'
import updateTableRow from '../../common/update-table-row'

export default defineAction({
  name: 'Update table data (multiple columns)',
  key: 'updateMultipleColumns',
  description: 'Update multiple columns in the workspace.',
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
      label: 'Update Columns',
      key: 'columnsToUpdate',
      type: 'multirow' as const,
      required: true,
      description: 'Specify column(s) to update with the update value',
      fields: [
        {
          key: 'columnName',
          type: 'dropdown' as const,
          placeholder: 'Select column',
          required: true,
          variables: true,
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
          key: 'columnValue',
          type: 'string' as const,
          required: true,
          variables: true,
          placeholder: 'Input value',
        },
      ],
    },
  ],

  async run($) {
    const columnsToUpdate =
      ($.step.parameters.columnsToUpdate as IJSONObject[]) ?? []
    if (columnsToUpdate.length === 0) {
      return
    }

    const payload: Record<string, string> = {}
    for (const column of columnsToUpdate) {
      if (column.columnName === VAULT_ID) {
        throw new Error('Cannot update the row id.')
      }

      payload[column.columnName as string] = column.columnValue as string
    }

    const row = await filterTableRows(
      $,
      $.step.parameters.lookupColumn as string,
      $.step.parameters.lookupValue as string,
    )
    await updateTableRow($, row['vault_id'], payload)
  },
})
