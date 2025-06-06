import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import {
  autoMarshallNumberStrings,
  stripInvalidKeys,
} from '@/models/tiles/dynamodb/helpers'
import { getTableOperations } from '@/models/tiles/factory'
import { PatchRowInput } from '@/models/tiles/types'

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
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
    },
    {
      label: 'Row data',
      key: 'rowData',
      type: 'multirow-multicol' as const,
      description:
        'Enter the data to update the row with. Columns not specified will not be updated.',
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
          customStyle: { flex: 2, minWidth: 0 },
        },
        {
          key: 'operator' as const,
          type: 'dropdown' as const,
          isSearchable: false,
          required: true,
          variables: false,
          showOptionValue: false,
          value: 'set',
          options: [
            { label: '=', value: 'set', description: 'Set as' },
            { label: '+', value: 'add', description: 'Add by (numbers only)' },
            {
              label: '-',
              value: 'subtract',
              description: 'Subtract by (numbers only)',
            },
          ],
          customStyle: { flexBasis: '71px' },
        },
        {
          placeholder: 'Value',
          key: 'cellValue',
          type: 'string' as const,
          required: false,
          variables: true,
          customStyle: { flex: 3, minWidth: 0 },
        },
      ],
    },
  ],
  getDataOutMetadata,

  async run($) {
    const { tableId, rowId, rowData } = $.step.parameters as {
      tableId: string
      rowId: string
      rowData: { columnId: string; cellValue: string; operator?: string }[]
    }

    if (!tableId) {
      throw new StepError(
        'Tile is required',
        'Please select a tile to update a row in.',
        $.step.position,
        $.app.name,
      )
    }

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

    const columnIds = table.columns.map((c) => c.id)

    await TableCollaborator.hasAccess($.user?.id, tableId, 'editor', $)

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

    function assertNumber(value: string): void {
      if (typeof autoMarshallNumberStrings(value) !== 'number') {
        throw new StepError(
          'Unable to update row',
          'The value to add or subtract by must be a number.',
          $.step.position,
          $.app.name,
        )
      }
    }

    const tableOperations = getTableOperations(table.db)

    const patchData = {
      ...rowData.reduce(
        (acc, { columnId, cellValue, operator }) => {
          // Check that the column still exists
          if (columnIds.includes(columnId)) {
            switch (operator) {
              case 'add':
                assertNumber(cellValue)
                acc.add[columnId] = cellValue
                break
              case 'subtract':
                assertNumber(cellValue)
                acc.subtract[columnId] = cellValue
                break
              // we default to set, since old operators will be undefined
              default:
                acc.set[columnId] = cellValue
                break
            }
          }
          return acc
        },
        { set: {}, add: {}, subtract: {} } as PatchRowInput['patchData'],
      ),
    }

    try {
      const updatedRow = await tableOperations.patchTableRow({
        tableId,
        rowId,
        patchData,
      })

      const updatedRowData = stripInvalidKeys({
        columnIds,
        data: updatedRow.data,
      })

      $.setActionItem({
        raw: {
          row: updatedRowData,
          rowId,
          updated: true,
        } satisfies UpdateRowOutput,
      })
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('The conditional request failed')) {
          // This means the corresponding row does not exist
          $.setActionItem({
            raw: {
              updated: false,
            } satisfies UpdateRowOutput,
          })
          return
        }
        throw new StepError(
          'Failed to update row',
          e.message,
          $.step.position,
          $.app.name,
        )
      }
      throw e
    }
  },
}

export default action
