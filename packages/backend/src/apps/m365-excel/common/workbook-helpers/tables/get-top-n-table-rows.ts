import z from 'zod'

import WorkbookSession from '../../workbook-session'

const msGraphResponseSchema = z
  .object({
    values: z.array(z.array(z.coerce.string())),
    rowIndex: z.number(),
  })
  .transform((response) => ({
    values: response.values,
    headerRowSheetRowIndex: response.rowIndex,
  }))

interface GetTopNTableRowsResult {
  columns: string[]
  rows: string[][]
  headerRowSheetRowIndex: number
}

export async function getTopNTableRows(
  session: WorkbookSession,
  tableId: string,
  n: number,
): Promise<GetTopNTableRowsResult> {
  const tableRowsParseResult = msGraphResponseSchema.safeParse(
    (
      await session.request(
        // This is a little tricky. Each path segment loosely corresponds to a
        // Graph API function call, and subsequent segments operate on the
        // output of the previous segment. Breakdown as follows:
        // * headerRowRange: Grabs the row containing column names
        // * resizedRange(deltaRows=...,deltaColumns=0): Extends our query
        //   range down by N + 1 rows (i.e. makes the query include our data
        //   rows). We fetch 1 more row to check if table is too large.
        // * usedRange: Tables can have less than N rows; this shrinks our query
        //   to only rows with data.
        `/tables/${tableId}/headerRowRange/resizedRange(deltaRows=${
          n + 1
        },deltaColumns=0)/usedRange?$select=values,rowIndex`,
        'get',
      )
    ).data,
  )

  if (tableRowsParseResult.success === false) {
    throw new Error(tableRowsParseResult.error.issues[0].message)
  }

  const tableRows = tableRowsParseResult.data

  if (tableRows.values.length === 0) {
    throw new Error('Ensure that table has a header row.')
  }

  // +1 for header row
  if (tableRows.values.length > n + 1) {
    throw new Error(
      `The table is too large; it has more than ${n} rows. Please reduce the table size.`,
    )
  }

  return {
    columns: tableRows.values[0],
    rows: tableRows.values.slice(1),
    headerRowSheetRowIndex: tableRows.headerRowSheetRowIndex,
  }
}
