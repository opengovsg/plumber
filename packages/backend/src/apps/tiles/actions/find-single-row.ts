import { IRawAction } from '@plumber/types'

import {
  findTableRows,
  TableRowFilter,
  TableRowFilterOperator,
} from '@/models/dynamodb/table-row'

import { validateTileAccess } from '../common/validate-tile-access'

const action: IRawAction = {
  name: 'Find single row',
  key: 'findSingleRow',
  description: 'Finds a single row in Tile',
  arguments: [
    {
      label: 'Select Tile',
      key: 'tableId',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      description: 'Select the tile you want to create a row in.',
      showOptionValue: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listTables',
          },
        ],
      },
    },
    {
      label: 'Lookup conditions',
      key: 'filters',
      type: 'multirow' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Column',
          key: 'columnId',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          showOptionValue: false,
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'listColumns',
              },
              {
                name: 'parameters.tableId',
                value: '{parameters.tableId}',
              },
            ],
          },
        },
        {
          placeholder: 'Operator',
          key: 'operator',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          showOptionValue: false,
          options: [
            { label: 'Equals to', value: TableRowFilterOperator.Equals },
            {
              label: 'Greater than ',
              value: TableRowFilterOperator.GreaterThan,
            },
            {
              label: 'Greater than or equals to',
              value: TableRowFilterOperator.GreaterThanOrEquals,
            },
            { label: 'Less than', value: TableRowFilterOperator.LessThan },
            {
              label: 'Less than or equals to',
              value: TableRowFilterOperator.LessThanOrEquals,
            },
            { label: 'Begins with', value: TableRowFilterOperator.BeginsWith },
            { label: 'Contains', value: TableRowFilterOperator.Contains },
            {
              label: 'is empty (leave value blank)',
              value: TableRowFilterOperator.IsEmpty,
            },
          ],
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: false,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const { tableId, filters } = $.step.parameters as {
      tableId: string
      filters: TableRowFilter[]
    }
    await validateTileAccess($.flow?.userId, tableId as string)

    const result = await findTableRows({ tableId, filters })

    $.setActionItem({
      raw: {
        success: true,
        rowCount: result.length,
        row: result.length > 0 ? result[0].data : null,
      },
    })
  },
}

export default action
