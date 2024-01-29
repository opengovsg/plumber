import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import {
  constructMsGraphValuesArrayForRowWrite,
  convertRowToHexEncodedRowRecord,
} from '../../common/workbook-helpers/tables'
import { getTopNTableRows } from '../../common/workbook-helpers/tables/get-top-n-table-rows'
import WorkbookSession from '../../common/workbook-session'

import getDataOutMetadata from './get-data-out-metadata'
import {
  dataOutSchema,
  parametersSchema,
  updateRowValuesResponseSchema,
} from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const MAX_ROWS = 10000

const action: IRawAction = {
  name: 'Update first found table row (SEE LIMITS IN GUIDE)',
  key: 'updateFirstFoundTableRow',
  description:
    // See comments in findFirstTableRow action for context.
    `Updates columns in the 1st table row whose column contains a value. Tables should not have more than ${MAX_ROWS} rows or 50000 cells.`,
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'File to update',
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
      description: 'Table to update',
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
      key: 'columnName' as const,
      type: 'dropdown' as const,
      showOptionValue: false,
      required: true,
      variables: false,
      label: 'Column',
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
      key: 'valueToFind' as const,
      label: 'Value to find',
      // We don't support matching on Excel-formatted text because it's very
      // weird (e.g. currency cells have a trailing space), and will lead to too
      // much user confusion.
      description:
        "Case sensitive. Do not include Excel's formatting (e.g. if Excel shows '$5.20', enter '5.2' instead). Leave blank to match empty cell.",
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      key: 'columnsToUpdate' as const,
      label: 'Columns to update',
      description: 'Specify columns you want to update',
      type: 'multirow' as const,
      required: true,
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
          required: false,
          variables: true,
          placeholder: 'Value to write. Leave blank to clear the cell',
        },
      ],
    },
  ],

  getDataOutMetadata,

  async run($) {
    const parametersParseResult = parametersSchema.safeParse($.step.parameters)

    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
        $.step?.position,
        $.app.name,
      )
    }

    const { fileId, tableId, columnName, valueToFind, columnsToUpdate } =
      parametersParseResult.data

    //
    // Find index of row to update
    //
    // See comment block in findFirstTableRow action for why we use a full
    // table scan (and why the IIFE).
    //

    const session = await WorkbookSession.acquire($, fileId)
    const { columns, rows, headerRowSheetRowIndex } = await (async () => {
      try {
        return await getTopNTableRows(session, tableId, MAX_ROWS)
      } catch (err) {
        throw new StepError(
          'There was a problem with the Excel table',
          err.message,
          $.step.position,
          $.app.name,
        )
      }
    })()

    const columnIndex = columns.indexOf(columnName)
    if (columnIndex === -1) {
      throw new StepError(
        `Could not find column "${columnName}" in excel table`,
        'Double-check that you have configured the step correctly.',
        $.step.position,
        $.app.name,
      )
    }

    let rowToUpdateIndex: number | null = null
    for (const [index, row] of rows.entries()) {
      if (row[columnIndex] === valueToFind) {
        rowToUpdateIndex = index
        break
      }
    }

    //
    // Perform update...
    //
    if (rowToUpdateIndex === null) {
      $.setActionItem({
        raw: {
          success: false,
        } satisfies DataOut,
      })
    }

    // Return updated row in case it has formulas.
    const updateRowValuesParseResult = updateRowValuesResponseSchema.safeParse(
      (
        await session.request(
          `/tables/${tableId}/rows/itemAt(index=${rowToUpdateIndex})`,
          'patch',
          {
            data: {
              values: [
                constructMsGraphValuesArrayForRowWrite(
                  columns,
                  // FIXME: Map is not needed here, but zod infers all object props as
                  // optional due to our lack of strict mode. Remove this when we
                  // enable strict mode.
                  columnsToUpdate.map((col) => ({
                    columnName: col.columnName,
                    value: col.value,
                  })),
                ),
              ],
            },
          },
        )
      ).data,
    )

    if (updateRowValuesParseResult.success === false) {
      throw new StepError(
        'There was a problem with the updated row.',
        updateRowValuesParseResult.error.issues[0].message,
        $.step.position,
        $.app.name,
      )
    }
    const updatedRow = updateRowValuesParseResult.data

    $.setActionItem({
      raw: {
        success: true,
        rowData: convertRowToHexEncodedRowRecord({ row: updatedRow, columns }),

        // See comment block in createTableRow for what this means.
        tableRowNumber: rowToUpdateIndex + 1,
        sheetRowNumber: headerRowSheetRowIndex + rowToUpdateIndex + 2,
      } satisfies DataOut,
    })
  },
}

export default action
