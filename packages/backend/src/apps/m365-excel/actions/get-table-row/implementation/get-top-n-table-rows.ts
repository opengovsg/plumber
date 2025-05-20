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

// Can get more info e.g. formulas, numberFormat, text for possible date manipulation but too complex for now
const msGraphRangeResponseSchema = z
  .object({
    rowCount: z.number(),
    rowIndex: z.number(),
    values: z.array(z.array(z.coerce.string())), // first row is the header
  })
  .transform((response) => ({
    rowCount: response.rowCount,
    headerSheetRowIndex: response.rowIndex,
    headerRowValues: response.values[0],
    rowValues: response.values.slice(1),
  }))

interface GetTopNTableRowsResult {
  columns: string[]
  rows: string[][]
  headerSheetRowIndex: number
}

/**
 * Using range endpoint to get both the header row and data rows
 * instead of headerRowRange and rows to avoid extra API call
 * Also, rows endpoint uses pagination so the query takes longer for large tables
 *
 * Considered using columns API but there is no headerSheetRowIndex returned so
 * an extra API call has to be made to retrieve it
 * Reference: https://learn.microsoft.com/en-us/graph/api/table-range?view=graph-rest-1.0&tabs=http
 */
export default async function getTopNTableRows(
  $: IGlobalVariable,
  session: WorkbookSession,
  tableId: string,
  n: number,
): Promise<GetTopNTableRowsResult> {
  const rangeParseResult = msGraphRangeResponseSchema.safeParse(
    (
      await session.request(
        `/tables/${tableId}/range?$select=values,rowCount,rowIndex`,
        'get',
      )
    ).data,
  )

  if (rangeParseResult.success === false) {
    throw new StepError(
      'Invalid table range',
      'Check your Excel file and try again',
      $.step.position,
      $.app.name,
    )
  }

  const { rowCount, headerSheetRowIndex, headerRowValues, rowValues } =
    rangeParseResult.data

  // rowCount includes the header row
  if (rowCount > n) {
    throw new StepError(
      `Your Excel table has more than ${n.toLocaleString()} rows.`,
      `Reduce the number of rows and try again.`,
      $.step.position,
      $.app.name,
    )
  }

  return {
    columns: headerRowValues,
    rows: rowValues,
    headerSheetRowIndex,
  }
}

// Old method in case we need to rollback fast
export async function getTopNTableRowsOld(
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
      'Received invalid table data',
      'Double check your Excel file and retry the step if needed',
      $.step.position,
      $.app.name,
    )
  }

  const tableRows = tableRowsParseResult.data

  if (tableRows.values.length === 0) {
    throw new StepError(
      'Excel table is missing the header row',
      'Ensure that your Excel table has a header row',
      $.step.position,
      $.app.name,
    )
  }

  // +1 for header row
  if (tableRows.values.length > n + 1) {
    throw new StepError(
      `Your Excel table has more than ${n.toLocaleString()} rows.`,
      `Reduce the number of rows and try again.`,
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
