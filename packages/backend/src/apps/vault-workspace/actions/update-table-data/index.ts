import defineAction from '../../../../helpers/define-action'
import { VAULT_ID } from '../../common/constants'
import filterTableRows from '../../common/filter-table-rows'
import updateTableRow from '../../common/update-table-row'

export default defineAction({
  name: 'Update table data',
  key: 'updateTableData',
  description: 'Update table data from the vault workspace.',
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

    // update row
    const payload: { [key: string]: string } = { [updateColumn]: updateValue }
    await updateTableRow($, row['vault_id'], payload)
  },
})
