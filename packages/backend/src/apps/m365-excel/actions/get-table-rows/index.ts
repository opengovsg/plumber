import type { IRawAction } from '@plumber/types'

import z from 'zod'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import StepError from '@/errors/step'

import { GET_TABLE_ROWS_LIMIT } from '../../common/constants'
import getTopNTableRows from '../../common/get-top-n-table-rows'
import { validateDynamicFieldsAndThrowError } from '../../common/validate-dynamic-fields'
import { convertRowToHexKeyedObject } from '../../common/workbook-helpers/tables/convert-row-to-hex-encoded-row-record'
import WorkbookSession from '../../common/workbook-session'
import { MAX_ROWS } from '../get-table-row/implementation'

import getDataOutMetadata from './get-data-out-metadata'
import { dataOutSchema, parametersSchema } from './schemas'

type DataOut = z.infer<typeof dataOutSchema>

const action: IRawAction = {
  name: 'Find table rows',
  key: 'getTableRows',
  description: 'Gets multiple rows of data from your Excel table',
  isNew: true,
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
    const { columns: rawColumns, rows } = await getTopNTableRows(
      $,
      session,
      tableId,
      MAX_ROWS,
    )

    const columnIndex = rawColumns.indexOf(lookupColumn)
    if (columnIndex === -1) {
      throw new StepError(
        `Column "${lookupColumn}" does not exist in your table.`,
        `Check that your Excel table contains the "${lookupColumn}" column.`,
        $.step.position,
        $.app.name,
      )
    }

    const rowsToReturn: { data: Record<string, string> }[] = []

    for (const [_, row] of rows.entries()) {
      if (row[columnIndex] === lookupValue) {
        rowsToReturn.push({
          data: convertRowToHexKeyedObject({ row, columns: rawColumns }),
        })
      }
    }

    // Max limit of 500 rows
    const slicedRows = rowsToReturn.slice(0, GET_TABLE_ROWS_LIMIT)

    $.setActionItem({
      raw: {
        rowsFound: slicedRows.length,
        data: {
          rows: slicedRows,
          columns: rawColumns.map((c) => {
            const hexEncodedColumnName = Buffer.from(c).toString('hex')
            return {
              id: hexEncodedColumnName,
              name: c,
              value: `data.rows.*.data.${hexEncodedColumnName}`,
            }
          }),
          inputSource: FOR_EACH_INPUT_SOURCE.M365_EXCEL,
        },
      } satisfies DataOut,
    })
  },
}

export default action
