import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'

import { CreateRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Create row',
  key: 'createTileRow',
  description: 'Creates a new row in your tile',
  arguments: [
    {
      label: 'Select Tile',
      key: 'tableId',
      type: 'dropdown' as const,
      required: true,
      variables: false,
      showOptionValue: false,
      addNewOption: {
        id: 'tiles-createTileRow-tableId',
        type: 'modal',
        label: 'Create a new tile',
      },
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
      label: 'New row data',
      key: 'rowData',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
      subFields: [
        {
          placeholder: 'Select or type to create a column',
          key: 'columnId',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          showOptionValue: false,
          addNewOption: {
            id: 'tiles-createTileRow-columnId',
            type: 'inline',
            label: 'Create a new column',
          },
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
          customStyle: { flex: 3 },
        },
        {
          placeholder: 'Value',
          key: 'cellValue',
          type: 'string' as const,
          required: false,
          variables: true,
          customStyle: { flex: 5, minWidth: 0, maxWidth: '62.5%' },
        },
      ],
    },
  ],

  getDataOutMetadata,

  async run($) {
    const { tableId, rowData } = $.step.parameters as {
      tableId: string
      rowData: { columnId: string; cellValue: string }[]
    }

    const table = await TableMetadata.query().findById(tableId)
    if (!table) {
      throw new StepError(
        'Tile not found',
        'Tile may have been deleted. Please check your tile.',
        $.step.position,
        'tiles',
      )
    }

    await TableCollaborator.hasAccess($.user?.id, tableId, 'editor', $)

    /**
     * convert array to object
     * [{columnId: 'abc', cellValue: 'test'}] => {abc: 'test'}
     */
    const rowDataObject = rowData.reduce((acc, { columnId, cellValue }) => {
      acc[columnId] = cellValue
      return acc
    }, {} as Record<string, string>)

    if (!(await table.validateRows([rowDataObject]))) {
      throw new StepError(
        'Invalid column ID(s)',
        'Column(s) may have been deleted or modified. Please check your tile and pipe setup.',
        $.step.position,
        $.app.name,
      )
    }

    const tableOperations = getTableOperations(table.db)

    const newRow = await tableOperations.createTableRow({
      tableId,
      data: rowDataObject,
    })

    $.setActionItem({
      raw: {
        rowId: newRow.rowId,
        row: newRow.data,
      } satisfies CreateRowOutput,
    })
  },
}

export default action
