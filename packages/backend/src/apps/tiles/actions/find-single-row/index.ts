import { IRawAction } from '@plumber/types'

import {
  getRawRowById,
  getTableRows,
  TableRowFilter,
  TableRowFilterOperator,
} from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

import { validateTileAccess } from '../../common/validate-tile-access'
import { FindSingleRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Find single row',
  key: 'findSingleRow',
  description: 'Gets data of a single row from your tile',
  arguments: [
    {
      label: 'Select Tile',
      key: 'tableId',
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
            value: 'listTables',
          },
        ],
      },
    },
    {
      label: 'Lookup conditions',
      description:
        'If multiple rows meet the conditions, the oldest entry will be returned',
      key: 'filters',
      type: 'multirow' as const,
      required: true,
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
          placeholder: 'Condition',
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
              label: 'Is empty',
              value: TableRowFilterOperator.IsEmpty,
            },
          ],
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
          hiddenIf: {
            fieldKey: 'operator',
            not: false,
            op: 'equals',
            fieldValue: TableRowFilterOperator.IsEmpty,
          },
        },
      ],
    },
    {
      label: 'Return most recent row instead?',
      key: 'returnLastRow',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      value: false,
      options: [
        {
          label: 'No (Returns oldest row)',
          value: false,
        },
        {
          label: 'Yes (Returns most recent row)',
          value: true,
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { tableId, filters, returnLastRow } = $.step.parameters as {
      tableId: string
      filters: TableRowFilter[]
      returnLastRow: boolean | undefined
    }
    await validateTileAccess($.flow?.userId, tableId as string)

    const columns = await TableColumnMetadata.query().where({
      table_id: tableId,
    })

    const result = await getTableRows({ tableId, filters })

    if (!result || !result.length) {
      $.setActionItem({
        raw: {
          rowsFound: 0,
        } satisfies FindSingleRowOutput,
      })
      return
    }
    const rowIdToUse = returnLastRow
      ? result[result.length - 1].rowId
      : result[0].rowId
    const rowToReturn = await getRawRowById({
      tableId,
      rowId: rowIdToUse,
      columnIds: columns.map((c) => c.id),
    })

    $.setActionItem({
      raw: {
        rowsFound: result.length,
        rowId: rowIdToUse,
        row: rowToReturn.data,
      } satisfies FindSingleRowOutput,
    })
  },
}

export default action
