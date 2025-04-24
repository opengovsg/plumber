import { IStep } from '@plumber/types'

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

export const isMultiRowStep = (step: IStep) => {
  return (
    (step.appKey === 'tiles' && step.key === 'findMultipleRows') ||
    (step.appKey === 'm365-excel' && step.key === 'getTableRows')
  )
}

export const processColumns = (
  rawColumns: any,
  isTilesStep: boolean,
  rowsObj?: any,
): Column[] => {
  const parsedColumns: Column[] = []
  // special handling for Tiles step to get the column ids
  const columnIds = isTilesStep ? rowsObj?.columns : {}

  rawColumns.forEach((c: any) => {
    parsedColumns.push({
      key: isTilesStep ? columnIds[c.label] : c.label,
      label: c.label,
      order: isTilesStep ? c.value ?? null : c.order ?? null,
    })
  })
  return parsedColumns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export const processData = (
  variables: Variable[] | null,
  isTilesStep: boolean,
): ProcessedData => {
  const rowsFoundObj = variables?.find(
    (v) => v.name.split('.').pop() === 'rowsFound',
  )

  const rawColumns = variables?.filter((v) => v.name.includes('columns'))
  const rawRowsObj = variables?.find((v) => v.name.split('.').pop() === 'rows')

  if (!rawRowsObj || !rawRowsObj.value) {
    return {
      rowsFound: '0',
      dataRows: [],
      columns: [],
    }
  }

  const rowsObj = JSON.parse(rawRowsObj.value as string)
  const dataRows = processDataRows(rowsObj, isTilesStep)
  const columns = processColumns(rawColumns, isTilesStep, rowsObj)

  return {
    rowsFound: rowsFoundObj?.value as string,
    dataRows,
    columns,
  }
}

export const processDataRows = (
  rowsObj: any,
  isTilesStep: boolean,
): DataRow[] => {
  if (isTilesStep) {
    return rowsObj?.rowData
  }

  return (
    rowsObj?.map((r: Record<string, Record<string, RowValue>>) => ({
      id: r.id,
      data: Object.fromEntries(
        Object.values(r.rowData as Record<string, RowValue>).map(
          ({ columnName, value }) => [columnName, value],
        ),
      ),
    })) || []
  )
}
