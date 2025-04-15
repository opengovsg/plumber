// dummy commit for do not merge branch
import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import { GET_TABLE_ROWS_LIMIT } from '../../common/constants'
import getTopNTableRows from '../../common/get-top-n-table-rows'
import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'
import { convertRowToHexEncodedRowRecord } from '../../common/workbook-helpers/tables'
import WorkbookSession from '../../common/workbook-session'
import { MAX_ROWS } from '../get-table-row/implementation'

import getDataOutMetadata from './get-data-out-metadata'
import { dataOutSchema, parametersSchema } from './schemas'

type DataOut = z.infer<typeof dataOutSchema>

const action: IRawAction = {
  name: 'Find table rows',
  key: 'getTableRows',
  description: 'Gets multiple rows of data from your Excel table',
  settingsStepLabel: 'Set up rows to get',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'This should be an Excel file in the folder created for you',
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
      // The MAX_ROWS row limit is a hard limit, but the cell limit is a soft
      // limit. The cell limit serves as messaging to tell users not to feed
      // enormous tables.
      description: `Tables should not have more than ${MAX_ROWS.toLocaleString()} rows or 100,000 cells`,
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
      key: 'lookupColumn' as const,
      type: 'dropdown' as const,
      showOptionValue: false,
      required: true,
      variables: false,
      label: 'Lookup column',
      description:
        'Only the first 500 rows that meet the condition will be returned',
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
      key: 'lookupValue' as const,
      label: 'Lookup Value',
      // We don't support matching on Excel-formatted text because it's very
      // weird (e.g. currency cells have a trailing space), and will lead to too
      // much user confusion.
      description:
        'Case sensitive and should not include units. E.g. $5.20 → 5.2',
      type: 'string' as const,
      required: true,
      variables: true,
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

    const { fileId, tableId, lookupColumn, lookupValue } =
      parametersParseResult.data

    // Validation to prevent path traversals
    validateDynamicFieldsAndThrowError({
      fileId,
      tableId,
      $,
    })

    const session = await WorkbookSession.acquire($, fileId)
    const { columns, rows, headerSheetRowIndex } = await getTopNTableRows(
      $,
      session,
      tableId,
      MAX_ROWS,
    )

    const columnIndex = columns.indexOf(lookupColumn)
    if (columnIndex === -1) {
      throw new StepError(
        `Column "${lookupColumn}" does not exist in your table.`,
        `Check that your Excel table contains the "${lookupColumn}" column.`,
        $.step.position,
        $.app.name,
      )
    }

    const rowsToReturn: {
      id: string
      tableRowIndex: number
      sheetRowNumber: number
      rowData: Record<string, { value?: string; columnName?: string }>
    }[] = []

    for (const [rowIndex, row] of rows.entries()) {
      if (row[columnIndex] === lookupValue) {
        rowsToReturn.push({
          id: `${rowIndex}-${rowIndex + headerSheetRowIndex + 2}`,
          tableRowIndex: rowIndex,
          sheetRowNumber: rowIndex + headerSheetRowIndex + 2,
          rowData: convertRowToHexEncodedRowRecord({
            row,
            columns,
          }),
        })
      }
    }

    if (rowsToReturn.length === 0) {
      $.setActionItem({
        raw: {
          rowsFound: 0,
          rows: [],
          columns: {},
        } satisfies DataOut,
      })

      return
    }

    // Max limit of 500 rows
    const slicedRows = rowsToReturn.slice(0, GET_TABLE_ROWS_LIMIT)

    const consolidatedColumns = columns.reduce((acc, column) => {
      const values: string[] = []
      for (const row of slicedRows) {
        const rowData = Object.entries(row.rowData).find(([_, value]) => {
          if (value.columnName === column) {
            return value.value
          }
        })

        const value = rowData?.[1].value
        if (value) {
          values.push(value)
        }
      }
      acc[column] = {
        id: column,
        value: values.join(', '),
        order: columns.indexOf(column) + 1,
      }
      return acc
    }, {} as Record<string, { id: string; value: string; order: number }>)

    $.setActionItem({
      raw: {
        rowsFound: slicedRows.length,
        rows: slicedRows,
        columns: consolidatedColumns,
      } satisfies DataOut,
    })
  },
}

export default action
