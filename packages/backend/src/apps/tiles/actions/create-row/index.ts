import { IRawAction } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'
import { createTableRow } from '@/models/dynamodb/table-row/functions'
import TableMetadata from '@/models/table-metadata'

import { validateTileAccess } from '../../common/validate-tile-access'

const action: IRawAction = {
  name: 'Create row',
  key: 'createTileRow',
  description: 'Creates a new row in Tile',
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
      label: 'New row data',
      key: 'rowData',
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
          placeholder: 'Value',
          key: 'cellValue',
          type: 'string' as const,
          required: false,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const { tableId, rowData } = $.step.parameters as {
      tableId: string
      rowData: { columnId: string; cellValue: string }[]
    }
    await validateTileAccess($.flow?.userId, tableId as string)

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
      throw generateStepError(
        'Invalid column id',
        'Column(s) may have been deleted or modified. Please check your tile and pipe setup.',
        $.step.position,
        'tiles',
      )
    }

    const newRow = await createTableRow({ tableId, data: rowDataObject })

    /**
     * convert row data keys from column ids to column names
     */
    const newRowData = await table.mapColumnIdsToNames(newRow.data)
    $.setActionItem({
      raw: {
        success: true,
        rowId: newRow.rowId,
        data: newRowData,
      },
    })
  },
}

export default action
