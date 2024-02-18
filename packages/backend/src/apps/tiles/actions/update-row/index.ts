import { IRawAction } from '@plumber/types'

import { stripInvalidKeys } from '@/models/dynamodb/helpers'
import { getRawRowById, updateTableRow } from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

import { validateTileAccess } from '../../common/validate-tile-access'
import { UpdateRowOutput } from '../../types'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'Update single row',
  key: 'updateSingleRow',
  description: 'Updates a single row in your tile',
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
    await validateTileAccess($.flow?.userId, tableId as string)

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

    const updatedData = {
      ...row.data,
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
      } satisfies UpdateRowOutput,
    })
  },
}

export default action
