import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import {
  constructMsGraphValuesArrayForRowWrite,
  convertRowToHexEncodedRowRecord,
} from '../../common/workbook-helpers/tables'
import { getTopNTableRows } from '../../common/workbook-helpers/tables/get-top-n-table-rows'
import WorkbookSession from '../../common/workbook-session'
import getTableRow from '../get-table-row'

import getDataOutMetadata from './get-data-out-metadata'
import {
  dataOutSchema,
  parametersSchema,
  updateRowValuesResponseSchema,
} from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const MAX_ROWS = 10000

const action: IRawAction = {
  name: 'Update table row',
  key: 'updateTableRow',
  description: 'Updates a single row of data in your Excel table',
  arguments: [
    // We're doing an update based on a lookup, so just re-use our lookup table
    // action args.
    ...getTableRow['arguments'],
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
          required: true,
          variables: true,
          placeholder: 'Value to write',
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

    const { fileId, tableId, lookupColumn, lookupValue, columnsToUpdate } =
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

    const columnIndex = columns.indexOf(lookupColumn)
    if (columnIndex === -1) {
      throw new StepError(
        `Could not find column "${lookupColumn}" in the excel table`,
        'Double-check that you have configured the step correctly.',
        $.step.position,
        $.app.name,
      )
    }

    let rowToUpdateIndex: number | null = null
    for (const [index, row] of rows.entries()) {
      if (row[columnIndex] === lookupValue) {
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
          foundRow: false,
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
        foundRow: true,
        rowData: convertRowToHexEncodedRowRecord({ row: updatedRow, columns }),

        // See comment block in createTableRow for what this means.
        tableRowNumber: rowToUpdateIndex + 1,
        sheetRowNumber: headerRowSheetRowIndex + rowToUpdateIndex + 2,
      } satisfies DataOut,
    })
  },
}

export default action
