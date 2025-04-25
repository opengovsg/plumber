import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import {
  getTableRows,
  TableRowFilter,
  TableRowFilterOperator,
} from '@/models/dynamodb/table-row'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'

import { FIND_MULTIPLE_ROWS_LIMIT } from '../../common/constants'
import { validateFilters } from '../../common/validate-filters'
import { FindMultipleRowsOutput, TileColumnMetadata } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Find multiple rows',
  key: 'findMultipleRows',
  description: 'Gets data of multiple rows from your tile',
  settingsStepLabel: 'Set up rows to find',
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
        'Only the first 500 rows that meet the conditions will be returned',
      key: 'filters',
      type: 'multirow' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
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
      label: 'Order of rows',
      key: 'returnLastRowFirst',
      type: 'boolean-radio' as const,
      required: true,
      value: false,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
      options: [
        {
          label: 'Ascending (oldest first)',
          value: false,
        },
        {
          label: 'Descending (newest first)',
          value: true,
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { tableId, filters, returnLastRowFirst } = $.step.parameters as {
      tableId: string
      filters: TableRowFilter[]
      returnLastRowFirst: string | undefined
    }

    const step = await Step.query().findById($.step.id).throwIfNotFound()
    /**
     * Check for columns first, there will not be any columns if the tile has been deleted.
     */
    const columns = await TableColumnMetadata.getColumns(tableId, $)

    await TableCollaborator.hasAccess($.user?.id, tableId, 'editor', $)

    // Check that filters are valid
    try {
      validateFilters(filters, columns)
    } catch (e) {
      logger.error({
        message: 'Invalid filters',
        executionId: $.execution.id,
        stepId: $.step.id,
        app: $.app.name,
        action: 'find-multiple-rows',
        error: e,
      })
      throw new StepError(
        'Invalid filters',
        'One or more filters are invalid. Please check that the columns in your filters still exist',
        $.step.position,
        $.app.name,
      )
    }
    // Retrieve the manual scan limit override, converting it to a number.
    // If the conversion results in NaN, we set scanLimit to undefined.
    const scanLimitRaw = +step.config?.adminOverride?.tileScanLimit
    const scanLimit = isNaN(scanLimitRaw) ? undefined : scanLimitRaw

    const { rows } = await getTableRows({
      tableId,
      columnIds: columns.map((c) => c.id),
      filters,
      order: returnLastRowFirst ? 'desc' : 'asc',
      scanLimit,
    })

    // NOTE: there are 2 types of column data that we return
    // 1. column name and id for use in for-each
    const columnData: Record<string, string> = {}
    columns
      .sort((a, b) => a.position - b.position)
      .forEach((c) => {
        columnData[c.id] = c.name
      })

    // 2. column data that combines all the values of all rows into a single string
    const consolidatedColumns = columns.reduce((acc, column) => {
      const values: string[] = []
      for (const row of rows) {
        const value = row.data[column.id]
        if (value) {
          values.push(value)
        }
      }
      acc[column.id] = {
        id: column.id,
        name: column.name,
        value: values.join(', '),
      }
      return acc
    }, {} as Record<string, TileColumnMetadata>)

    const slicedRows = rows.slice(0, FIND_MULTIPLE_ROWS_LIMIT)

    $.setActionItem({
      raw: {
        rowsFound: slicedRows.length,
        rows: {
          rowData: slicedRows,
          columns: columnData,
        },
        columns: consolidatedColumns,
      } satisfies FindMultipleRowsOutput,
    })
  },
}

export default action
