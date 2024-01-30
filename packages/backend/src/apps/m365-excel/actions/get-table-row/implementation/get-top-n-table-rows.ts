import { type IGlobalVariable } from '@plumber/types'

import z from 'zod'

import StepError from '@/errors/step'

import WorkbookSession from '../../../common/workbook-session'

const msGraphResponseSchema = z
  .object({
    values: z.array(z.array(z.coerce.string())),
    rowIndex: z.number(),
  })
  .transform((response) => ({
    values: response.values,
    headerSheetRowIndex: response.rowIndex,
  }))

interface GetTopNTableRowsResult {
  columns: string[]
  rows: string[][]
  headerSheetRowIndex: number
}

export default async function getTopNTableRows(
  // Typically, we should avoid making $ viral though the codebase, but this is
  // an exception because getTopNTableRows is not a common helper function.
  $: IGlobalVariable,
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
    throw new StepError(
      `Received invalid table data: '${tableRowsParseResult.error.issues[0].message}'.`,
      'Retry the step.',
      $.step.position,
      $.app.name,
    )
  }

  const tableRows = tableRowsParseResult.data

  if (tableRows.values.length === 0) {
    throw new StepError(
      'Excel table is missing the header row',
      'Ensure that your Excel table has a header row.',
      $.step.position,
      $.app.name,
    )
  }

  // +1 for header row
  if (tableRows.values.length > n + 1) {
    throw new StepError(
      'Excel table is too large',
      `Your excel table has more than ${n} rows. Please reduce the table size.`,
      $.step.position,
      $.app.name,
    )
  }

  return {
    columns: tableRows.values[0],
    rows: tableRows.values.slice(1),
    headerSheetRowIndex: tableRows.headerSheetRowIndex,
  }
}
