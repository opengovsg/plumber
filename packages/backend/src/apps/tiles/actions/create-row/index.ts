import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import { createTableRow } from '@/models/dynamodb/table-row/functions'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'

import { CreateRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Create row',
  key: 'createTileRow',
  description: 'Creates a new row in your tile',
  settingsStepLabel: 'Set up row to create',
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
      type: 'multirow' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
      subFields: [
        {
          placeholder: 'Select a column or type to create one',
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
  helpMessage:
    'Customise your columns and choose the data that goes into them. You can recreate this example for this template.',

  getDataOutMetadata,

  async run($) {
    const { tableId, rowData } = $.step.parameters as {
      tableId: string
      rowData: { columnId: string; cellValue: string }[]
    }

    await TableCollaborator.hasAccess($.user?.id, tableId, 'owner', $)

    const table = await TableMetadata.query().findById(tableId)

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
        'tiles',
      )
    }

    const newRow = await createTableRow({ tableId, data: rowDataObject })

    $.setActionItem({
      raw: {
        rowId: newRow.rowId,
        row: newRow.data,
      } satisfies CreateRowOutput,
    })
  },
}

export default action
