import { type IGlobalVariable } from '@plumber/types'
import z from 'zod'

import StepError from '@/errors/step'

import WorkbookSession from './workbook-session'

// Can get more info e.g. formulas, numberFormat, text for possible date manipulation but too complex for now
const msGraphRangeResponseSchema = z
  .object({
    rowCount: z.number(),
    rowIndex: z.number(),
    values: z.array(z.array(z.coerce.string())), // first row is the header
  })
  .transform((response) => {
    if (response.values.length === 0) {
      throw new Error('Excel table is missing the header row')
    }
    return {
      rowCount: response.rowCount,
      headerSheetRowIndex: response.rowIndex,
      headerRowValues: response.values[0],
      rowValues: response.values.slice(1),
    }
  })

interface GetTopNTableRowsResult {
  columns: string[]
  rows: string[][]
  headerSheetRowIndex: number
}

/**
 * Using range endpoint to get both the header row and data rows
 * instead of headerRowRange and rows to avoid extra API call
 * Range endpoint API time taken (similar to the previous resized range method)
 * - Around 0.5s for 50k rows with 5 columns of data
 * - Around 0.25s for 25k rows with 3 columns of empty data
 * - Around 0.15s for 10k rows with 3 columns of empty data
 *
 * Also, rows endpoint uses pagination so the query takes longer for large tables
 * Rows endpoint API time taken:
 * - Around 5s for 50k rows with 5 columns of data
 * - Around 2s for 25k rows with 3 columns of empty data
 * - Around 1s for 10k rows with 3 columns of empty data
 *
 * Considered using columns API but there is no headerSheetRowIndex returned so
 * an extra API call has to be made to retrieve it
 * Reference: https://learn.microsoft.com/en-us/graph/api/table-range?view=graph-rest-1.0&tabs=http
 */
export async function getTopNTableRows(
  $: IGlobalVariable,
  session: WorkbookSession,
  tableId: string,
  n: number,
): Promise<GetTopNTableRowsResult> {
  const rangeParseResult = msGraphRangeResponseSchema.safeParse(
    (
      await session.request(
        `/tables/:tableId/range?$select=values,rowCount,rowIndex`,
        'get',
        {
          urlPathParams: {
            tableId,
          },
        },
      )
    ).data,
  )

  if (rangeParseResult.success === false) {
    throw new StepError({
      name: 'Could not read table headers.',
      solution:
        'Your Excel table may span the maximum number of columns (XFD). Delete unused columns at the end of the table.',
      kind: 'config',
    })
  }

  const { rowCount, headerSheetRowIndex, headerRowValues, rowValues } =
    rangeParseResult.data

  // rowCount includes the header row
  if (rowCount > n + 1) {
    throw new StepError({
      name: `Your Excel table has more than ${n.toLocaleString()} rows.`,
      solution: `Reduce the number of rows and try again.`,
      kind: 'config',
    })
  }

  return {
    columns: headerRowValues,
    rows: rowValues,
    headerSheetRowIndex,
  }
}

export default getTopNTableRows
