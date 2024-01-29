import type { IJSONObject, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import { constructMsGraphValuesArrayForRowWrite } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'

interface TableHeaderInfo {
  rowIndex: number
  columnNames: string[] // Ordered
}

const action: IRawAction = {
  name: 'Create row',
  key: 'createTableRow',
  description: 'Creates a new row in your Excel table',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'This should be a file in your Plumber folder.',
      type: 'dropdown' as const,
      showOptionValue: false,
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
      type: 'dropdown' as const,
      showOptionValue: false,
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
          key: 'columnName' as const,
          type: 'dropdown' as const,
          showOptionValue: false,
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
    const { fileId, tableId } = $.step.parameters
    const columnValues = ($.step.parameters.columnValues as IJSONObject[]) ?? []
    if (columnValues.length === 0) {
      $.setActionItem({
        raw: {
          success: true,
        },
      })
      return
    }

    // Sanity check user's config.
    const seenColumnNames = new Set<string>()
    for (const val of columnValues) {
      const currColumnName = String(val.columnName)

      if (seenColumnNames.has(currColumnName)) {
        throw new StepError(
          `Cannot write 2 different values to the same column (${currColumnName})`,
          `Click on set up action and make sure '${currColumnName}' only appears once.`,
          $.step?.position,
          $.app.name,
        )
      }

      seenColumnNames.add(currColumnName)
    }

    const session = await WorkbookSession.acquire($, fileId as string)

    const tableHeaderInfoResponse = await session.request<{
      rowIndex: number
      values: string[][] // Guaranteed to be length 1 at top level
    }>(`/tables/${tableId}/headerRowRange?$select=rowIndex,values`, 'get')
    const tableHeaderInfo: TableHeaderInfo = {
      rowIndex: tableHeaderInfoResponse.data.rowIndex,
      columnNames: tableHeaderInfoResponse.data.values[0],
    }

    const createRowResponse = await session.request<{ index: number }>(
      `/tables/${tableId}/rows`,
      'post',
      {
        data: {
          index: null,
          values: [
            (() => {
              // IIFE which throws StepError to avoid $ becoming viral
              // throughout the codebase.
              try {
                return constructMsGraphValuesArrayForRowWrite(
                  tableHeaderInfo.columnNames,
                  columnValues.map((val) => ({
                    columnName: String(val.columnName),
                    value: String(val.value),
                  })),
                )
              } catch (err) {
                throw new StepError(
                  'Error creating table row',
                  err.message,
                  $.step.position,
                  $.app.name,
                )
              }
            })(),
          ],
        },
      },
    )

    $.setActionItem({
      raw: {
        // `tableRowNumber` exposes the row number of the created row _relative_
        // to the first data row in the table (i.e. the table's header row is
        // taken to be row 0, and the 1st data row - if it exists - is taken to
        // be row 1).
        //
        // e.g. if I initially have an empty table with header row at row 10,
        // and I create a row of data, that created row's tableRowNumber would
        // be 1 (since it's the 1st row of data).
        //
        // createRowResponse.data.index actually contains this "relative row
        // number", except that it's 0-indexed. So we add 1 before returning it.
        tableRowNumber: createRowResponse.data.index + 1,

        // `sheetRowNumber` exposes the actual row number of the created row.
        //
        // e.g. if I initially have an empty table with header row at row 10,
        // and I add a row of data, that created row's sheetRowNumber would be
        // 11.
        //
        // tableHeaderInfoResponse.data.rowIndex contains the 0-indexed row
        // number of the table's _header_ row. It follows that we can compute
        // the sheet row number via:
        //
        //   /* Compute the header's row number ... */
        //   tableHeaderInfoResponse.data.rowIndex + 1
        //   /* ...and add... */
        //   +
        //   /* ... tableRowNumber (see above) to header's row number */
        //   createRowResponse.data.index + 1
        sheetRowNumber:
          tableHeaderInfoResponse.data.rowIndex +
          1 +
          createRowResponse.data.index +
          1,
        success: true,
      },
    })
  },
}

export default action
