import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import {
  getRawRowById,
  getTableRows,
  TableRowFilter,
  TableRowFilterOperator,
} from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

import { validateFilters } from '../../common/validate-filters'
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
      value: 'no',
      showOptionValue: false,
      options: [
        {
          label: 'No (Returns oldest row)',
          value: 'no',
        },
        {
          label: 'Yes (Returns most recent row)',
          value: 'yes',
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

    // Check that filters are valid
    try {
      validateFilters(filters, columns)
    } catch (e) {
      logger.error({
        message: 'Invalid filters',
        executionId: $.execution.id,
        stepId: $.step.id,
        app: $.app.name,
        action: 'find-single-row',
        error: e,
      })
      throw new StepError(
        'Invalid filters',
        'One or more filters are invalid. Please check that the columns in your filters still exist',
        $.step.position,
        $.app.name,
      )
    }

    const result = await getTableRows({
      tableId,
      filters,
    })

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

    /**
     * We use raw row data instead of mapped column names as we want them to
     * be distinct in data_out
     */
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
