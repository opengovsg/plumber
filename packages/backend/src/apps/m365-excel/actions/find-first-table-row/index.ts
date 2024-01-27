import type { IRawAction } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import WorkbookSession from '../../common/workbook-session'

import getDataOutMetadata from './get-data-out-metadata'
import {
  dataOutSchema,
  parametersSchema,
  tableRowResponseSchema,
} from './schemas'

type DataOut = Required<z.infer<typeof dataOutSchema>>

const MAX_ROWS = 10000

const action: IRawAction = {
  name: 'Find first table row (SEE LIMITS IN GUIDE)',
  key: 'findFirstTableRow',
  description:
    // The MAX_ROWS row limit is a hard limit, but the cell / column limit (50k cells
    // implies 5 cols @ 10k rows) is a soft limit. The cell limit serves as
    // messaging to tell users not to feed enormous tables.
    `Finds the 1st table row whose column contains a value. Tables should not have more than ${MAX_ROWS} rows or 50000 cells.`,
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'File to read from',
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
      description: 'Table to find from',
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

    const { fileId, tableId, columnName, valueToFind } =
      parametersParseResult.data

    const session = await WorkbookSession.acquire($, fileId)
    const tableRows = tableRowResponseSchema.parse(
      (
        await session.request(
          // This is a little tricky. Each path segment loosely corresponds to a
          // Graph API function call, and subsequent segments operate on the
          // output of the previous segment. Breakdown as follows:
          // * headerRowRange: Grabs the row containing column names
          // * resizedRange(deltaRows=...,deltaColumns=0): Extends our query
          //   range down by MAX_ROWS + 1 rows (i.e. makes the query include our
          //   data rows). We fetch 1 more row to check if table is too large.
          // * usedRange: Most tables will not have 5k rows; this shrinks our
          //   query to only rows with data.
          `/tables/${tableId}/headerRowRange/resizedRange(deltaRows=${
            MAX_ROWS + 1
          },deltaColumns=0)/usedRange?$select=rowIndex,values`,
          'get',
        )
      ).data,
    )

    const columns = tableRows.values[0]
    const columnIndex = columns.indexOf(columnName)

    if (columnIndex === -1) {
      throw new StepError(
        `Could not find column "${columnName}" in excel table`,
        'Double-check that you have configured the find first table row excel step correctly.',
        $.step.position,
        $.app.name,
      )
    }

    // +1 for header row
    if (tableRows.values.length > MAX_ROWS + 1) {
      throw new StepError(
        `Table is too large`,
        `Your table has more than ${MAX_ROWS} rows and is too large for the "find first table row" action. Please reduce the size of your table.`,
        $.step.position,
        $.app.name,
      )
    }

    let foundRow: string[] | null = null
    let foundRowIndex: number | null = null
    for (const [dataRowIndex, dataRow] of tableRows.values.slice(1).entries()) {
      if (dataRow[columnIndex] === valueToFind) {
        foundRow = dataRow
        foundRowIndex = dataRowIndex
        break
      }
    }

    if (!foundRow) {
      $.setActionItem({
        raw: {
          success: false,
        } satisfies DataOut,
      })

      return
    }

    // Hex-encode column names to account for our parameter regex.
    const rowData: Extract<DataOut, { success: true }>['rowData'] =
      Object.create(null)
    for (const [cellIndex, cell] of foundRow.entries()) {
      const cellColumnName = columns[cellIndex]
      const hexEncodedColumnName = Buffer.from(cellColumnName).toString('hex')

      rowData[hexEncodedColumnName] = {
        value: cell,
        columnName: cellColumnName,
      }
    }

    $.setActionItem({
      raw: {
        success: true,
        rowData,

        // See createTableRow action for what these mean.
        tableRowNumber: foundRowIndex + 1,
        sheetRowNumber: tableRows.rowIndex + foundRowIndex + 2,
      } satisfies DataOut,
    })
  },
}

export default action
