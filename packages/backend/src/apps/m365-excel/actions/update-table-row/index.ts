import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import {
  constructMsGraphValuesArrayForRowWrite,
  convertRowToHexEncodedRowRecord,
} from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import getTableRowAction from '../get-table-row'
import getTableRowImpl from '../get-table-row/implementation'

import getDataOutMetadata from './get-data-out-metadata'
import {
  dataOutSchema,
  parametersSchema,
  updateRowValuesResponseSchema,
} from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const action: IRawAction = {
  name: 'Update table row',
  key: 'updateTableRow',
  description: 'Updates a single row of data in your Excel table',
  arguments: [
    // We're doing an update based on results of our getTableRow action, so just
    // re-use its arguments.
    ...getTableRowAction['arguments'],
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
    const findRowResults = await getTableRowImpl({
      $,
      session,
      tableId,
      lookupValue,
      lookupColumn,
    })

    if (!findRowResults) {
      $.setActionItem({
        raw: {
          updatedRow: false,
        } satisfies DataOut,
      })
    }

    const { tableRowIndex, sheetRowNumber, columns } = findRowResults

    //
    // Perform update...
    //

    // Return updated row in case it has formulas.
    const updateRowValuesParseResult = updateRowValuesResponseSchema.safeParse(
      (
        await session.request(
          `/tables/${tableId}/rows/itemAt(index=${tableRowIndex})`,
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
        `Received invalid row data after update: '${updateRowValuesParseResult.error.issues[0].message}'`,
        'Double check your Excel file and retry the step if needed',
        $.step.position,
        $.app.name,
      )
    }
    const updatedRow = updateRowValuesParseResult.data

    $.setActionItem({
      raw: {
        updatedRow: true,
        rowData: convertRowToHexEncodedRowRecord({ row: updatedRow, columns }),
        sheetRowNumber,
      } satisfies DataOut,
    })
  },
}

export default action
