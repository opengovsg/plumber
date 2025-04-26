import { IExecutionStep, IStep } from '@plumber/types'

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
  rowData: Array<{ rowId: string; data: Record<string, string> }>
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
  const isTilesStep = executionStep.appKey === 'tiles'
  const rowsFound = String(executionStep.dataOut?.rowsFound ?? '0')
  const rawColumns = executionStep.dataOut?.columns
  const rowsObj = executionStep.dataOut?.rows as unknown as
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
    dataRows: isTilesStep ? rowsObj.rowData : processDataRows(rowsObj),
    columns: processColumns(rawColumns),
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
