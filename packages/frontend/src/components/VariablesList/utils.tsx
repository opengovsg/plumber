import { IExecutionStep } from '@plumber/types'

import { ExecutionStepDataOutSchema } from './schema'

export interface RawColumn {
  id: string
  name: string
  value: string
}

export interface RawRow {
  data: Record<string, string | number | null>
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

const processColumns = (rawColumns: RawColumn[]): ProcessedColumn[] => {
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
