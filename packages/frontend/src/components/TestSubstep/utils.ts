import { IStep } from '@plumber/types'

import { Variable } from '@/helpers/variables'

export interface Column {
  key: string
  label: string
}
interface RowValue {
  columnName: string
  value: string
}

export interface DataRow {
  id: string
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
  rowsObj: any,
  isTilesStep: boolean,
): Column[] => {
  const parsedColumns: Column[] = []
  const columns = isTilesStep ? rowsObj.columns : rowsObj?.[0].rowData
  Object.keys(columns).forEach((key) => {
    if (key !== 'Row ID') {
      parsedColumns.push({
        key: isTilesStep ? columns[key] : columns[key].columnName,
        label: isTilesStep ? key : columns[key].columnName,
      })
    }
  })
  return parsedColumns
}

export const processData = (
  variables: Variable[] | null,
  isTilesStep: boolean,
): ProcessedData => {
  const rowsFoundObj = variables?.find(
    (v) => v.name.split('.').pop() === 'rowsFound',
  )

  const rawRowsObj = variables?.find((v) => v.name.split('.').pop() === 'rows')

  if (!rawRowsObj) {
    return {
      rowsFound: '0',
      dataRows: [],
      columns: [],
    }
  }

  const rowsObj = JSON.parse(rawRowsObj.value as string)
  const dataRows = processDataRows(rowsObj, isTilesStep)
  const columns = processColumns(rowsObj, isTilesStep)

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
    return JSON.parse(rowsObj?.rowData as string)
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
