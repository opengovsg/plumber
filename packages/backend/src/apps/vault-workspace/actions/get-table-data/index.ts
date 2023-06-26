import defineAction from '@/helpers/define-action'

import filterTableRows from '../../common/filter-table-rows'

export default defineAction({
  name: 'Get table data',
  key: 'getTableData',
  description: 'Get table data from the vault workspace.',
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

  async run($) {
    const lookupColumn = $.step.parameters.lookupColumn as string
    const lookupValue = $.step.parameters.lookupValue as string
    const row = await filterTableRows($, lookupColumn, lookupValue)
    $.setActionItem({
      raw: row,
    })
  },
})
