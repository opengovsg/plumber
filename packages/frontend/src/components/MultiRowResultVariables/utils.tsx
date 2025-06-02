import { IExecutionStep, IStep } from '@plumber/types'

import { Variable } from '@/helpers/variables'

export interface Column {
  key: string
  label: string
  order?: number | null
}
interface RowValue {
  columnName: string
  value: string
}

export interface DataRow {
  id?: string
  rowId?: string
  data: Record<string, string>
  row?: Record<string, RowValue>
}

export interface ProcessedData {
  rowsFound: string
  dataRows: DataRow[]
  columns: Column[]
}

interface TilesRowsData {
  rows: Array<{ rowId: string; data: Record<string, string> }>
  columns: Array<{ id: string; name: string }>
}

export const isMultiRowStep = (step: IStep) => {
  return (
    (step.appKey === 'tiles' && step.key === 'findMultipleRows') ||
    (step.appKey === 'm365-excel' && step.key === 'getTableRows')
  )
}

export const processColumns = (rawColumns: unknown): Column[] => {
  if (!Array.isArray(rawColumns)) {
    return []
  }

  return rawColumns
    .map((column: { id: string; name: string }, index: number) => ({
      key: column.id,
      label: column.name,
      order: index,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export const processData = (executionStep: IExecutionStep): ProcessedData => {
  const rowsFound = String(executionStep.dataOut?.rowsFound ?? '0')
  const rowsObj = executionStep.dataOut?.data as unknown as
    | TilesRowsData
    | undefined

  if (!rowsObj) {
    return {
      rowsFound,
      dataRows: [],
      columns: [],
    }
  }

  return {
    rowsFound,
    dataRows: rowsObj.rows,
    columns: processColumns(rowsObj.columns),
  }
}

export const processDataRows = (rowsObj: any): DataRow[] => {
  return (
    rowsObj?.map((r: Record<string, Record<string, RowValue>>) => ({
      id: r.id,
      data: Object.fromEntries(
        Object.entries(r.rowData as Record<string, RowValue>).map(
          ([key, value]) => [key, value.value],
        ),
      ),
    })) || []
  )
}

export const getColumnValues = (rowData: Variable | undefined) => {
  if (!rowData) {
    return []
  }
  const rowDataObj = JSON.parse(rowData.value as string)
  const { rows, columns } = rowDataObj
  const columnVariables = columns.map(
    (column: { id: string; name: string }) => {
      const rowValues: string[] = []
      rows.forEach((row: { data: Record<string, string> }) => {
        /**
         * NOTE: do not push empty values as we do not want to cause any errors
         * that may arise from having empty values.
         */
        if (row.data[column.id]) {
          rowValues.push(row.data[column.id])
        }
      })

      return {
        ...column,
        label: column.name,
        value: rowValues.join(', '),
        type: 'string',
      }
    },
  )

  return columnVariables
}
