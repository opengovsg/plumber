import { IRawAction } from '@plumber/types'

import filterTableRows from '../../common/filter-table-rows'

import getDataOutMetadata from './get-data-out-metadata'

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
  ],
  getDataOutMetadata,

  async run($) {
    const lookupColumn = $.step.parameters.lookupColumn as string
    const lookupValue = $.step.parameters.lookupValue as string
    const row = await filterTableRows($, lookupColumn, lookupValue)
    $.setActionItem({
      raw: row,
    })
  },
}

export default action
