import { IExecutionStep, IStep } from '@plumber/types'

import { Variable } from '@/helpers/variables'

import { ExecutionStepDataOutSchema, VariableToRowDataSchema } from './schema'

export interface RawColumn {
  id: string
  name: string
  value: string
}

export interface RawRow {
  data: Record<string, string | number>
  rowId?: string // only Tiles will have this
}

export interface ProcessedColumn {
  key: string
  label: string
  order?: number | null
}
export interface ProcessedRow extends RawRow {
  id?: string
}

export interface ProcessedData {
  rowsFound: string
  dataRows: ProcessedRow[]
  columns: ProcessedColumn[]
}

export const isMultiRowStep = (step: IStep) => {
  return (
    (step.appKey === 'tiles' && step.key === 'findMultipleRows') ||
    (step.appKey === 'm365-excel' && step.key === 'getTableRows')
  )
}

export const processColumns = (rawColumns: RawColumn[]): ProcessedColumn[] => {
  if (!Array.isArray(rawColumns)) {
    return []
  }

  return rawColumns
    .map((column: RawColumn, index: number) => ({
      key: column.id,
      label: column.name,
      order: index,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export const processData = (executionStep: IExecutionStep): ProcessedData => {
  try {
    const dataOut = ExecutionStepDataOutSchema.parse(executionStep.dataOut)
    const rowsFound = String(dataOut.rowsFound)

    return {
      rowsFound,
      dataRows: dataOut.data.rows,
      columns: processColumns(dataOut.data.columns),
    }
  } catch (error) {
    console.error('Failed to validate execution step data:', error)
    return {
      rowsFound: '0',
      dataRows: [],
      columns: [],
    }
  }
}

export const getColumnValues = (dataVariable: Variable | undefined) => {
  if (!dataVariable) {
    return []
  }

  try {
    const rowDataObj = VariableToRowDataSchema.parse(dataVariable)

    const { rows, columns } = rowDataObj
    const columnVariables = columns.map((column: RawColumn) => {
      const rowValues: (string | number)[] = []
      rows.forEach((row: RawRow) => {
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
    })

    return columnVariables
  } catch (error) {
    console.error('Failed to validate or parse row data:', error)
    return []
  }
}
