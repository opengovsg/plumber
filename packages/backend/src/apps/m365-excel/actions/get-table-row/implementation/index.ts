import type { IGlobalVariable } from '@plumber/types'

import StepError from '@/errors/step'

import type WorkbookSession from '../../../common/workbook-session'

import getTopNTableRows from './get-top-n-table-rows'

// Grabbing ~50k rows takes ~5s. This is similar to our attachment download
// latency from FormSG, so should be ok...
//
// Also note that MS (currently) has no data fetch limit, and pagination is not
// required. So safe to fetch all these rows in a single go.
export const MAX_ROWS = 50000

interface GetTableRowImplParams {
  $: IGlobalVariable
  session: WorkbookSession
  tableId: string
  lookupValue: string
  lookupColumn: string
}

interface GetTableRowImplResults {
  tableRowIndex: number
  sheetRowNumber: number
  row: string[]
  columns: string[]
}

/**
 * This implements the getTableRow action, but it's abstracted out so that it
 * can also be used by updateTableRow.
 *
 * ** NOTE **
 * ==========
 *
 * This does a _full table scan_ in order to minimize the number of queries made
 * to M365. This decision was made because a full table scan more than halves
 * the queries needed (from 5 to 2), and we are more constrained by our _very
 * very low_ M365 rate limit than our available compute.
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
 *   1. Although we only fetch up to MAX_ROWS rows, fetching large tables with
 *      many columns could take a lot of time. This should be very rare, but if
 *      this ever becomes common we could mitigate it by querying only the
 *      lookup column first, then making another query to get the full row data
 *      for the matched row.
 *   2. Long strings in cells may cause our scan to be slow. This should also be
 *      rare; if this ever becomes an issue, we could restrict the max length of
 *      the value to match.
 **/
export default async function getTableRowImpl(
  args: GetTableRowImplParams,
): Promise<GetTableRowImplResults | null> {
  const { $, session, tableId, lookupValue, lookupColumn } = args

  const { columns, rows, headerSheetRowIndex } = await getTopNTableRows(
    $,
    session,
    tableId,
    MAX_ROWS,
  )

  const columnIndex = columns.indexOf(lookupColumn)
  if (columnIndex === -1) {
    throw new StepError(
      'Lookup Column not found',
      `Ensure that your Excel table contains the "${lookupColumn}" column.`,
      $.step.position,
      $.app.name,
    )
  }

  for (const [rowIndex, row] of rows.entries()) {
    if (row[columnIndex] === lookupValue) {
      return {
        tableRowIndex: rowIndex,
        sheetRowNumber: rowIndex + headerSheetRowIndex + 2,
        row,
        columns,
      }
    }
  }

  return null
}
