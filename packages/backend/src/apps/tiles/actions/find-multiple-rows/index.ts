import { IRawAction } from '@plumber/types'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import { TableRowFilter } from '@/models/tiles/types'

import {
  FIND_MULTIPLE_ROWS_LIMIT,
  LOOKUP_CONDITIONS_SUBFIELDS,
} from '../../common/constants'
import { validateFilters } from '../../common/validate-filters'
import { FindMultipleRowsOutput, TileColumnMetadata } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Find multiple rows',
  key: 'findMultipleRows',
  description: 'Gets data of multiple rows from your tile',
  isNew: true,
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
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
      subFields: LOOKUP_CONDITIONS_SUBFIELDS,
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
    const table = await TableMetadata.query()
      .findById(tableId)
      .withGraphFetched('columns')

    if (!table) {
      throw new StepError(
        'Tile not found',
        'Tile may have been deleted. Please check your tile.',
        $.step.position,
        $.app.name,
      )
    }

    await TableCollaborator.hasAccess($.user?.id, tableId, 'editor', $)

    // Check that filters are valid
    try {
      validateFilters(filters, table.columns)
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

    const tableOperations = getTableOperations(table.db)

    const { rows } = await tableOperations.getTableRows({
      tableId,
      columnIds: table.columns.map((c) => c.id),
      filters,
      order: returnLastRowFirst ? 'desc' : 'asc',
      scanLimit,
    })

    const columnData: TileColumnMetadata[] = []
    table.columns
      .sort((a, b) => a.position - b.position)
      .forEach((c) => {
        columnData.push({
          id: c.id,
          name: c.name,
          value: `data.rows.*.data.${c.id}`,
        })
      })

    const slicedRows = rows.slice(0, FIND_MULTIPLE_ROWS_LIMIT)

    $.setActionItem({
      raw: {
        rowsFound: slicedRows.length,
        data: {
          rows: slicedRows,
          columns: columnData,
          inputSource: FOR_EACH_INPUT_SOURCE.TILES,
        },
      } satisfies FindMultipleRowsOutput,
    })
  },
}

export default action
