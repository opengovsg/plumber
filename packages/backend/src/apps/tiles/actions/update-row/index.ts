import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import { stripInvalidKeys } from '@/models/dynamodb/helpers'
import { getRawRowById, updateTableRow } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'

import { UpdateRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Update single row',
  key: 'updateSingleRow',
  description: 'Updates a single row in your tile',
  settingsStepLabel: 'Set up row to update',
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
      label: 'Row ID',
      key: 'rowId',
      type: 'string' as const,
      required: true,
      variables: true,
      description: 'This can be retrieved from the Find Single Row action',
    },
    {
      label: 'Row data',
      key: 'rowData',
      type: 'multirow' as const,
      description:
        'Enter the data to update the row with. Columns not specified will not be updated.',
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
          placeholder: 'Value',
          key: 'cellValue',
          type: 'string' as const,
          required: false,
          variables: true,
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { tableId, rowId, rowData } = $.step.parameters as {
      tableId: string
      rowId: string
      rowData: { columnId: string; cellValue: string }[]
    }

    if (!tableId) {
      throw new StepError(
        'Tile is required',
        'Please select a tile to update a row in.',
        $.step.position,
        $.app.name,
      )
    }

    await TableCollaborator.hasAccess($.user?.id, tableId, 'owner', $)

    /**
     * Row ID is empty, this could be because the previous get single row action
     * could not find a row that satisfies the conditions. We do not fail the action.
     */
    if (!rowId) {
      $.setActionItem({
        raw: {
          updated: false,
        } satisfies UpdateRowOutput,
      })
      return
    }

    const columns = await TableColumnMetadata.query()
      .where({
        table_id: tableId,
      })
      .select('id', 'name')
    const columnIds = columns.map((c) => c.id)

    const row = await getRawRowById({
      tableId,
      rowId,
      columnIds,
    })

    /**
     * Row ID does not correspond to a row, we short circuit the action but do not fail it.
     */
    if (!row) {
      $.setActionItem({
        raw: {
          updated: false,
        } satisfies UpdateRowOutput,
      })
      return
    }

    const updatedData = {
      ...(row.data ?? {}),
      ...rowData.reduce((acc, { columnId, cellValue }) => {
        acc[columnId] = cellValue
        return acc
      }, {} as Record<string, string>),
    }

    const strippedUpdatedData = stripInvalidKeys({
      columnIds,
      data: updatedData,
    })

    await updateTableRow({
      tableId,
      rowId,
      data: strippedUpdatedData,
    })

    $.setActionItem({
      raw: {
        row: strippedUpdatedData,
        rowId,
        updated: true,
      } satisfies UpdateRowOutput,
    })
  },
}

export default action
