import type { IJSONObject, IRawAction } from '@plumber/types'

import { runWithM365RequestSafetyNet } from '../../common/request-safety-net'
import WorkbookSession from '../../common/workbook-session'

interface TableInfo {
  columnCount: number
  rowIndex: number
}

interface ColumnValue {
  index: number
  value: string
}

// MS Graph expects the row data to be an array of the same length as the number
// of columns in the table, with values in the same order as the corresponding
// column index.
function constructMsGraphArgment(
  tableInfo: TableInfo,
  columnValues: ColumnValue[],
): Array<string | null> {
  columnValues.sort((lhs, rhs) => lhs.index - rhs.index)
  const largestColumnIndex = columnValues[columnValues.length - 1].index

  if (tableInfo.columnCount <= largestColumnIndex) {
    throw new Error('Trying to write to non-existent column.')
  }

  const result: Array<string | null> = new Array(tableInfo.columnCount).fill(
    null,
  )
  for (const columnValue of columnValues) {
    result[columnValue.index] = columnValue.value
  }
  return result
}

const action: IRawAction = {
  name: 'Create row',
  key: 'create-table-row',
  description: 'Creates a new row in the excel spreadsheet table',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'File to edit',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listFiles',
          },
        ],
      },
    },
    {
      key: 'tableId',
      label: 'Table',
      required: true,
      description: 'Table to add new rows to',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listTables',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
        ],
      },
    },
    {
      label: 'Values',
      key: 'columnValues',
      type: 'multirow' as const,
      required: true,
      description: 'Specify values you want to insert in the new row',
      subFields: [
        {
          key: 'index' as const,
          type: 'dropdown' as const,
          required: true,
          variables: false,
          placeholder: 'Column',
          source: {
            type: 'query' as const,
            name: 'getDynamicData' as const,
            arguments: [
              {
                name: 'key',
                value: 'listTableColumns',
              },
              {
                name: 'parameters.fileId',
                value: '{parameters.fileId}',
              },
              {
                name: 'parameters.tableId',
                value: '{parameters.tableId}',
              },
            ],
          },
        },
        {
          key: 'value' as const,
          type: 'string' as const,
          required: true,
          variables: true,
          placeholder: 'Value',
        },
      ],
    },
  ],

  async run($) {
    return await runWithM365RequestSafetyNet($, async () => {
      const { fileId, tableId } = $.step.parameters
      const columnValues =
        ($.step.parameters.columnValues as IJSONObject[]) ?? []
      if (columnValues.length === 0) {
        $.setActionItem({
          raw: {
            success: true,
          },
        })
        return
      }

      const session = await WorkbookSession.create($, fileId as string)

      const tableInfoResponse = await session.request<TableInfo>(
        `/tables/${tableId}/range?$select=columnCount,rowIndex`,
        'get',
      )
      const createRowResponse = await session.request<{ index: number }>(
        `/tables/${tableId}/rows`,
        'post',
        {
          data: {
            index: null,
            values: [
              constructMsGraphArgment(
                tableInfoResponse.data,
                columnValues.map((val) => ({
                  index: Number(val.index),
                  value: String(val.value),
                })),
              ),
            ],
          },
        },
      )

      await session.closeIfLastExcelStepInPipe()

      $.setActionItem({
        raw: {
          relativeRowNumber: createRowResponse.data.index + 1,
          rowNumber:
            tableInfoResponse.data.rowIndex + createRowResponse.data.index + 2,
          success: true,
        },
      })
    })
  },
}

export default action
