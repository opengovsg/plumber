import { IRawAction } from '@plumber/types'

import IntermediateStepError from '@/errors/intermediate-step-error'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import {
  getRawRowById,
  getTableRows,
  TableRowFilter,
  TableRowFilterOperator,
} from '@/models/dynamodb/table-row'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'

import { validateFilters } from '../../common/validate-filters'
import { FindSingleRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Find single row',
  key: 'findSingleRow',
  description: 'Gets data of a single row from your tile',
  settingsStepLabel: 'Set up row to find',
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
      label: 'Return most recent row instead?',
      key: 'returnLastRow',
      type: 'boolean-radio' as const,
      required: true,
      value: false,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
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
    try {
      const {
        tableId,
        filters: rawFilters,
        returnLastRow,
      } = $.step.parameters as {
        tableId: string
        filters: TableRowFilter[]
        returnLastRow: boolean | undefined
      }

      const step = await Step.query().findById($.step.id).throwIfNotFound()
      /**
       * Check for columns first, there will not be any columns if the tile has been deleted.
       */
      const columns = await TableColumnMetadata.getColumns(tableId, $)

      await TableCollaborator.hasAccess($.user?.id, tableId, 'editor', $)

      // Check that filters are valid and extract the GSI filter if it exists
      const { filters, gsi } = validateFilters(rawFilters, columns)

      // Retrieve the manual scan limit override, converting it to a number.
      // If the conversion results in NaN, we set scanLimit to undefined.
      const scanLimitRaw = +step.config?.adminOverride?.tileScanLimit
      const scanLimit = isNaN(scanLimitRaw) ? undefined : scanLimitRaw

      const { rows } = await getTableRows({
        tableId,
        filters,
        order: returnLastRow ? 'desc' : 'asc',
        scanLimit,
        gsi,
      })

      if (!rows || !rows.length) {
        $.setActionItem({
          raw: {
            rowsFound: 0,
          } satisfies FindSingleRowOutput,
        })
        return
      }
      const rowIdToUse = rows[0].rowId

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
          rowsFound: rows.length,
          rowId: rowIdToUse,
          row: rowToReturn.data,
        } satisfies FindSingleRowOutput,
      })
    } catch (e) {
      logger.error({
        message: 'Find single row error',
        executionId: $.execution?.id,
        stepId: $.step.id,
        app: $.app.name,
        error: e,
      })
      if (e instanceof IntermediateStepError) {
        throw StepError.fromIntermediateStepError(e, {
          position: $.step.position,
          appName: $.app.name,
        })
      }
      throw new StepError(
        'Find single row error',
        'An error occurred while finding the single row',
        $.step.position,
        $.app.name,
        e,
      )
    }
  },
}

export default action
