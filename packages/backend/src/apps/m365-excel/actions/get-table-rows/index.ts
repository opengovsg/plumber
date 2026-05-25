import type { IRawAction } from '@plumber/types'

import z from 'zod'

import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'
import StepError from '@/errors/step'

import {
  GET_TABLE_ROWS_LIMIT,
  LOOKUP_CONDITIONS_SUBFIELDS,
} from '../../common/constants'
import getTopNTableRows from '../../common/get-top-n-table-rows'
import { lookupParametersSchema } from '../../common/schema'
import { convertRowToHexKeyedObject } from '../../common/workbook-helpers/tables/convert-row-to-hex-encoded-row-record'
import WorkbookSession from '../../common/workbook-session'
import { MAX_ROWS } from '../get-table-row/implementation'

import getDataOutMetadata from './get-data-out-metadata'
import { dataOutSchema } from './schemas'

type DataOut = z.infer<typeof dataOutSchema>

const action: IRawAction = {
  name: 'Find multiple table rows',
  key: 'getTableRows',
  description: 'Gets multiple rows of data from your Excel table',
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
      key: 'filters',
      label: 'Lookup conditions',
      description:
        'Lookup values are case sensitive and should not include units (e.g., $5.20 → 5.2). Leave blank to search for empty cells.',
      type: 'multirow-multicol' as const,
      required: true,
      subFields: LOOKUP_CONDITIONS_SUBFIELDS,
      maxRows: 1, // Phase 1: Restrict to single filter
      hiddenIf: {
        fieldKey: 'tableId',
        op: 'is_empty',
      },
    },
  ],

  getDataOutMetadata,

  async run($) {
    const parametersParseResult = lookupParametersSchema.safeParse(
      $.step.parameters,
    )

    if (parametersParseResult.success === false) {
      throw new StepError(
        'There was a problem with the input.',
        parametersParseResult.error.issues[0].message,
      )
    }

    const { fileId, tableId, filters } = parametersParseResult.data
    const { lookupColumn, lookupValue } = filters![0]

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
