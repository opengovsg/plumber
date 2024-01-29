import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import { convertRowToHexEncodedRowRecord } from '../../common/workbook-helpers/tables'
import { getTopNTableRows } from '../../common/workbook-helpers/tables/get-top-n-table-rows'
import WorkbookSession from '../../common/workbook-session'

import getDataOutMetadata from './get-data-out-metadata'
import { dataOutSchema, parametersSchema } from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const MAX_ROWS = 10000

const action: IRawAction = {
  name: 'Get table row',
  key: 'getTableRow',
  description: 'Gets a single row of data from your Excel table.',
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
      // The MAX_ROWS row limit is a hard limit, but the cell / column limit
      // (50k cells implies 5 cols @ 10k rows) is a soft limit. The cell limit
      // serves as messaging to tell users not to feed enormous tables.
      description: `Tables should not have more than ${MAX_ROWS.toLocaleString()} rows or 50,000 cells.`,
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
      label: 'Lookup Column',
      description:
        'Specify a column we should look for cells which match the Lookup Value.',
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
        "Value is case sensitive and should not include units e.g. if Excel shows '$5.20', enter '5.2'.",
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

    /**
     * ** NOTE **
     *
     * This does a _full table scan_ in order to minimize the number of queries
     * made to M365. This decision was made because a full table scan more than
     * halves the queries needed (from 5 to 2), and we are more constrained by
     * our _very very low_ M365 rate limit than our available compute.
     *
     * A comparison of queries needed:
     *
     * |      WITHOUT FULL TABLE SCAN     |        WITH FULL TABLE SCAN        |
     * | -------------------------------- | ---------------------------------- |
     * | 1. Create workbook session.      | 1. Create workbook session         |
     * | 2. Query table address range.    | 2. Query all table rows starting   |
     * | 3. Perform a MATCH() formula     |    from header row, up to the      |
     * |    call on table's address       |    MAX_ROW-th row. Then compute    |
     * |    range to find the 1st row     |    the action output using this    |
     * |    number which satisfies the    |    alone.                          |
     * |    search criteria.              |                                    |
     * | 4. Query table row data using    |                                    |
     * |    row number from MATCH's       |                                    |
     * |    output                        |                                    |
     * | 5. Query table colum names. Use  |                                    |
     * |    that and the output from step |                                    |
     * |    step 4 to generate the action |                                    |
     * |    output                        |                                    |
     *
     * The main pitfalls and mitigations for this are:
     *   1. Although we only fetch up to MAX_ROWS rows, fetching large tables
     *      with many columns could take a lot of time. This should be very
     *      rare, but if this ever becomes common we could mitigate it by
     *      querying only the searched-for column first, then making another
     *      query to get the full row data for the matched row.
     *   2. Long strings in cells may cause our scan to be slow. This should
     *      also be rare; if this ever becomes an issue, we could restrict the
     *      max length of the value to match.
     **/

    const { fileId, tableId, lookupColumn, lookupValue } =
      parametersParseResult.data

    const session = await WorkbookSession.acquire($, fileId)
    const { columns, rows, headerRowSheetRowIndex } = await (async () => {
      // Using an IIFE here to avoid passing $ to API / helper functions. $ is
      // already becoming viral in the codebase - very bad.
      // FIXME (ogp-weeloong): Probably we can evolve StepError to account for
      // this....?
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
        `Could not find column "${lookupColumn}" in excel table`,
        'Double-check that you have configured the step correctly.',
        $.step.position,
        $.app.name,
      )
    }

    let foundRowIndex: number | null = null
    for (const [rowIndex, row] of rows.entries()) {
      if (row[columnIndex] === lookupValue) {
        foundRowIndex = rowIndex
        break
      }
    }

    if (foundRowIndex === null) {
      $.setActionItem({
        raw: {
          foundRow: false,
        } satisfies DataOut,
      })

      return
    }

    $.setActionItem({
      raw: {
        foundRow: true,
        // Hex-encode column names to account for our parameter regex.
        rowData: convertRowToHexEncodedRowRecord({
          row: rows[foundRowIndex],
          columns,
        }),

        // See createTableRow action for what these mean.
        tableRowNumber: foundRowIndex + 1,
        sheetRowNumber: headerRowSheetRowIndex + foundRowIndex + 2,
      } satisfies DataOut,
    })
  },
}

export default action
